#!/usr/bin/env python3
import argparse
import html
import json
import os
import re
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
DEFAULT_BACKEND_PORT = int(os.environ.get("BACKEND_PORT", "8787"))
DEFAULT_FRONTEND_PORT = int(os.environ.get("FRONTEND_PORT", "8080"))
DEFAULT_DRIVER_PORT = int(os.environ.get("SAFARI_DRIVER_PORT", "4445"))


def log(message):
    print(message, flush=True)


def fail(message, exit_code=1):
    print(f"Error: {message}", file=sys.stderr, flush=True)
    raise SystemExit(exit_code)


def parse_args():
    parser = argparse.ArgumentParser(
        description="Local Safari smoke test for booking travel-plan autosave."
    )
    parser.add_argument("--backend-port", type=int, default=DEFAULT_BACKEND_PORT)
    parser.add_argument("--frontend-port", type=int, default=DEFAULT_FRONTEND_PORT)
    parser.add_argument("--username", default=os.environ.get("ATP_SMOKE_USERNAME", "joachim"))
    parser.add_argument("--password", default=os.environ.get("ATP_SMOKE_PASSWORD", "atp"))
    parser.add_argument("--driver-port", type=int, default=DEFAULT_DRIVER_PORT)
    parser.add_argument("--keep-booking", action="store_true")
    parser.add_argument("--skip-restart", action="store_true")
    return parser.parse_args()


def run_local_script(relative_path):
    script_path = ROOT_DIR / relative_path
    subprocess.run([str(script_path)], cwd=ROOT_DIR, check=True)


def wait_for_http(url, timeout_seconds=30):
    deadline = time.time() + timeout_seconds
    last_error = None
    while time.time() < deadline:
      try:
        with urllib.request.urlopen(url, timeout=3) as response:
          if 200 <= response.status < 500:
            return True
      except Exception as error:  # noqa: BLE001
        last_error = error
      time.sleep(0.5)
    if last_error:
      raise last_error
    raise TimeoutError(f"Timed out waiting for {url}")


def ensure_local_stack(backend_port, frontend_port, skip_restart):
    backend_health_url = f"http://localhost:{backend_port}/health"
    frontend_root_url = f"http://127.0.0.1:{frontend_port}/"
    if skip_restart:
        wait_for_http(backend_health_url)
        wait_for_http(frontend_root_url)
        return

    try:
        wait_for_http(backend_health_url, timeout_seconds=2)
    except Exception:  # noqa: BLE001
        log("Starting local backend ...")
        run_local_script("scripts/start_local_backend.sh")

    try:
        wait_for_http(frontend_root_url, timeout_seconds=2)
    except Exception:  # noqa: BLE001
        log("Starting local frontend ...")
        run_local_script("scripts/start_local_frontend.sh")

    wait_for_http(backend_health_url)
    wait_for_http(frontend_root_url)


def read_response_text(response):
    return response.read().decode("utf-8", errors="replace")


def open_text(url, *, method="GET", data=None, headers=None):
    request = urllib.request.Request(url, method=method)
    for key, value in (headers or {}).items():
        request.add_header(key, value)
    if data is not None:
        if isinstance(data, str):
            data = data.encode("utf-8")
        request.data = data
    with urllib.request.urlopen(request, timeout=20) as response:
        return read_response_text(response), response


def open_json(url, *, method="GET", payload=None, headers=None):
    next_headers = {"Accept": "application/json", **(headers or {})}
    data = None
    if payload is not None:
        next_headers["Content-Type"] = "application/json"
        data = json.dumps(payload).encode("utf-8")
    body, response = open_text(url, method=method, data=data, headers=next_headers)
    return json.loads(body), response


def create_booking(backend_port):
    payload = {
        "destinations": ["VN"],
        "travel_style": ["Grand Expeditions"],
        "name": "Travel Plan Autosave Smoke Test",
        "email": "autosave-smoke@asiatravelplan.local",
        "phone_number": "+84999999999",
        "preferred_currency": "USD",
        "preferred_language": "en"
    }
    booking_response, _response = open_json(
        f"http://localhost:{backend_port}/public/v1/bookings",
        method="POST",
        payload=payload
    )
    booking_id = (((booking_response or {}).get("booking") or {}).get("id") or "").strip()
    if not booking_id:
        fail("Could not create smoke-test booking.")
    return booking_id


def parse_login_form_action(page_html):
    match = re.search(r'<form[^>]+id="kc-form-login"[^>]+action="([^"]+)"', page_html)
    if not match:
        fail("Could not find Keycloak login form action.")
    return html.unescape(match.group(1))


def run_curl(args, *, text=True):
    result = subprocess.run(
        ["curl", "-sS", *args],
        cwd=ROOT_DIR,
        check=True,
        capture_output=True,
        text=text
    )
    return result.stdout


def extract_header(headers_text, name):
    pattern = re.compile(rf"^{re.escape(name)}:\s*(.+?)\s*$", re.IGNORECASE | re.MULTILINE)
    match = pattern.search(headers_text)
    return match.group(1).strip() if match else ""


def extract_session_cookie(cookie_file_path):
    for line in Path(cookie_file_path).read_text(encoding="utf-8").splitlines():
        if not line:
            continue
        normalized_line = line
        if normalized_line.startswith("#HttpOnly_"):
            normalized_line = normalized_line.removeprefix("#HttpOnly_")
        elif normalized_line.startswith("#"):
            continue
        parts = normalized_line.split("\t")
        if len(parts) >= 7 and parts[5] == "asiatravelplan_session":
            return parts[6].strip()
    return ""


def authenticate_local_session(backend_port, username, password):
    login_url = f"http://localhost:{backend_port}/auth/login?return_to=http://localhost:8080/backend.html"
    with tempfile.NamedTemporaryFile(prefix="atp-smoke-cookies-", suffix=".txt", delete=False) as handle:
        cookie_file = handle.name

    try:
        login_headers = run_curl(["-D", "-", "-o", "/dev/null", "-c", cookie_file, "-b", cookie_file, login_url])
        auth_url = extract_header(login_headers, "Location")
        if not auth_url:
            fail("Could not resolve local Keycloak authorization URL.")

        login_page = run_curl(["-c", cookie_file, "-b", cookie_file, auth_url])
        action_url = parse_login_form_action(login_page)
        form_data = urllib.parse.urlencode({
            "username": username,
            "password": password,
            "credentialId": "",
            "login": "Sign in"
        })

        auth_headers = run_curl([
            "-D", "-", "-o", "/dev/null",
            "-c", cookie_file, "-b", cookie_file,
            "-X", "POST",
            action_url,
            "-H", "Content-Type: application/x-www-form-urlencoded",
            "--data", form_data
        ])
        callback_url = extract_header(auth_headers, "Location")
        if not callback_url:
            fail("Keycloak login did not return a backend callback URL.")

        run_curl(["-D", "-", "-o", "/dev/null", "-c", cookie_file, "-b", cookie_file, callback_url])
        session_cookie = extract_session_cookie(cookie_file)
        if not session_cookie:
            fail(
                "Could not obtain backend session cookie. "
                "Check local Keycloak login and backend callback flow."
            )
        return session_cookie
    finally:
        try:
            os.unlink(cookie_file)
        except FileNotFoundError:
            pass


def auth_headers(session_cookie):
    return {"Cookie": f"asiatravelplan_session={session_cookie}"}


def get_booking(backend_port, booking_id, session_cookie):
    payload, _response = open_json(
        f"http://localhost:{backend_port}/api/v1/bookings/{booking_id}",
        headers=auth_headers(session_cookie)
    )
    booking = (payload or {}).get("booking") or {}
    if not booking:
        fail(f"Booking {booking_id} could not be loaded.")
    return booking


def delete_booking(backend_port, booking_id, session_cookie):
    try:
        booking = get_booking(backend_port, booking_id, session_cookie)
        open_text(
            f"http://localhost:{backend_port}/api/v1/bookings/{booking_id}",
            method="DELETE",
            data=json.dumps({
                "expected_core_revision": int(booking.get("core_revision") or 0)
            }),
            headers={
                **auth_headers(session_cookie),
                "Content-Type": "application/json"
            }
        )
    except urllib.error.HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")
        log(f"Warning: could not delete smoke-test booking {booking_id}: HTTP {error.code} {body[:300]}")


class SafariWebDriver:
    def __init__(self, port):
        self.port = port
        self.process = None
        self.session_id = None
        self.log_file = None

    @property
    def base_url(self):
        return f"http://127.0.0.1:{self.port}"

    def start(self):
        try:
            self.log_file = open("/tmp/atp-safaridriver.log", "w", encoding="utf-8")
            self.process = subprocess.Popen(
                ["safaridriver", "-p", str(self.port)],
                stdout=self.log_file,
                stderr=subprocess.STDOUT,
                cwd=ROOT_DIR
            )
        except FileNotFoundError:
            fail("safaridriver is not installed on this Mac.")

        deadline = time.time() + 10
        last_error = None
        while time.time() < deadline:
            try:
                with urllib.request.urlopen(f"{self.base_url}/status", timeout=2) as response:
                    payload = json.loads(read_response_text(response))
                    if ((payload or {}).get("value") or {}).get("ready"):
                        return
            except Exception as error:  # noqa: BLE001
                last_error = error
            time.sleep(0.3)

        if self.process and self.process.poll() is None:
            self.process.terminate()
        message = (
            "Could not start safaridriver. "
            "If this is the first run on this Mac, enable it once with 'safaridriver --enable'."
        )
        if last_error:
            message = f"{message} Root error: {last_error}"
        fail(message)

    def _request(self, method, path, payload=None):
        url = f"{self.base_url}{path}"
        headers = {"Accept": "application/json"}
        data = None
        if payload is not None:
            headers["Content-Type"] = "application/json"
            data = json.dumps(payload).encode("utf-8")
        request = urllib.request.Request(url, method=method, data=data, headers=headers)
        try:
            with urllib.request.urlopen(request, timeout=20) as response:
                body = read_response_text(response)
                return json.loads(body) if body else {}
        except urllib.error.HTTPError as error:
            body = error.read().decode("utf-8", errors="replace")
            try:
                payload = json.loads(body)
            except json.JSONDecodeError:
                payload = None
            message = ((payload or {}).get("value") or {}).get("message") or body or str(error)
            if "Allow remote automation" in message:
                fail(
                    "Safari WebDriver is not enabled. "
                    "Open Safari > Settings > Advanced > Show features for web developers, "
                    "then in the Develop menu enable 'Allow Remote Automation'."
                )
            fail(f"Safari WebDriver request failed with HTTP {error.code}: {message}")

    def create_session(self):
        payload = {
            "capabilities": {
                "alwaysMatch": {
                    "browserName": "Safari",
                    "acceptInsecureCerts": True
                }
            }
        }
        response = self._request("POST", "/session", payload)
        self.session_id = (
            ((response or {}).get("value") or {}).get("sessionId")
            or response.get("sessionId")
        )
        if not self.session_id:
            fail("Could not create Safari WebDriver session.")

    def navigate(self, url):
        self._request("POST", f"/session/{self.session_id}/url", {"url": url})

    def add_cookie(self, name, value, domain="localhost", path="/"):
        self._request("POST", f"/session/{self.session_id}/cookie", {
            "cookie": {
                "name": name,
                "value": value,
                "domain": domain,
                "path": path
            }
        })

    def execute(self, script, args=None):
        response = self._request("POST", f"/session/{self.session_id}/execute/sync", {
            "script": script,
            "args": args or []
        })
        return (response or {}).get("value")

    def quit(self):
        if self.session_id:
            try:
                self._request("DELETE", f"/session/{self.session_id}")
            except Exception:  # noqa: BLE001
                pass
            self.session_id = None
        if self.process and self.process.poll() is None:
            self.process.terminate()
            try:
                self.process.wait(timeout=3)
            except subprocess.TimeoutExpired:
                self.process.kill()
        if self.log_file:
            self.log_file.close()
            self.log_file = None


def wait_until(predicate, timeout_seconds=10, description="condition"):
    deadline = time.time() + timeout_seconds
    last_value = None
    while time.time() < deadline:
        last_value = predicate()
        if last_value:
            return last_value
        time.sleep(0.25)
    fail(f"Timed out waiting for {description}. Last value: {last_value!r}")


def browser_wait_for_editor(driver):
    wait_until(
        lambda: driver.execute(
            """
            const panel = document.querySelector('#travel_plan_panel');
            const summary = document.querySelector('#travel_plan_panel_summary');
            if (!panel || !summary) return false;
            if (!panel.classList.contains('is-open')) summary.click();
            return panel.classList.contains('is-open');
            """
        ),
        description="travel-plan panel to open"
    )
    wait_until(
        lambda: driver.execute(
            "return Boolean(document.querySelector('[data-travel-plan-add-day]'));"
        ),
        description="travel-plan add-day button"
    )


def assert_no_save_button(driver):
    has_no_button = driver.execute(
        "return !document.querySelector('#travel_plan_save_btn');"
    )
    if not has_no_button:
        fail("Travel-plan Save button is still present in booking.html.")


def add_day(driver):
    added = driver.execute(
        """
        const button = document.querySelector('[data-travel-plan-add-day]');
        if (!button) return false;
        button.click();
        return true;
        """
    )
    if not added:
        fail("Could not click travel-plan add-day button.")
    wait_until(
        lambda: driver.execute("return document.querySelectorAll('[data-travel-plan-day]').length === 1;"),
        description="first travel-plan day to render"
    )


def set_day_title(driver, value):
    changed = driver.execute(
        """
        const input = document.querySelector(
          '[data-travel-plan-day] [data-travel-plan-day-field="title"][data-localized-lang="en"][data-localized-role="source"]'
        );
        if (!input) return false;
        input.focus();
        input.value = arguments[0];
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.blur();
        return true;
        """,
        [value]
    )
    if not changed:
        fail("Could not set travel-plan day title.")


def add_item(driver):
    added = driver.execute(
        """
        const button = document.querySelector('[data-travel-plan-add-item]');
        if (!button) return false;
        button.click();
        return true;
        """
    )
    if not added:
        fail("Could not click travel-plan add-item button.")
    wait_until(
        lambda: driver.execute("return document.querySelectorAll('[data-travel-plan-item]').length === 1;"),
        description="first travel-plan item to render"
    )


def set_item_title(driver, value):
    changed = driver.execute(
        """
        const input = document.querySelector(
          '[data-travel-plan-item] [data-travel-plan-item-field="title"][data-localized-lang="en"][data-localized-role="source"]'
        );
        if (!input) return false;
        input.focus();
        input.value = arguments[0];
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.blur();
        return true;
        """,
        [value]
    )
    if not changed:
        fail("Could not set travel-plan item title.")


def get_status_text(driver):
    return driver.execute(
        "return String(document.querySelector('#travel_plan_status')?.textContent || '').trim();"
    ) or ""


def main():
    args = parse_args()
    booking_id = None
    session_cookie = None
    driver = SafariWebDriver(args.driver_port)

    try:
        ensure_local_stack(args.backend_port, args.frontend_port, args.skip_restart)
        log("Local backend/frontend are up.")

        booking_id = create_booking(args.backend_port)
        log(f"Created smoke-test booking: {booking_id}")

        session_cookie = authenticate_local_session(
            args.backend_port,
            args.username,
            args.password
        )
        log("Authenticated local backend session.")

        auth_me, _response = open_json(
            f"http://localhost:{args.backend_port}/auth/me",
            headers=auth_headers(session_cookie)
        )
        if not auth_me.get("authenticated"):
            fail("Local backend session was not authenticated after login.")

        driver.start()
        driver.create_session()
        log("Started Safari WebDriver session.")

        driver.navigate(f"http://localhost:{args.frontend_port}/index.html")
        driver.add_cookie("asiatravelplan_session", session_cookie)
        driver.navigate(f"http://localhost:{args.frontend_port}/booking.html?id={booking_id}")

        browser_wait_for_editor(driver)
        assert_no_save_button(driver)
        log("Verified: no travel-plan Save button is present.")

        initial_booking = get_booking(args.backend_port, booking_id, session_cookie)
        if int(initial_booking.get("travel_plan_revision") or 0) != 0:
            fail("Fresh smoke-test booking did not start with travel_plan_revision = 0.")

        add_day(driver)
        time.sleep(1.2)
        booking_after_empty_day = get_booking(args.backend_port, booking_id, session_cookie)
        if int(booking_after_empty_day.get("travel_plan_revision") or 0) != 0:
            fail("Empty day draft unexpectedly autosaved before the required title was filled.")
        log("Verified: empty new day does not autosave.")

        set_day_title(driver, "Smoke test day")
        wait_until(
            lambda: int(get_booking(args.backend_port, booking_id, session_cookie).get("travel_plan_revision") or 0) == 1,
            description="travel-plan day autosave"
        )
        booking_after_day_title = get_booking(args.backend_port, booking_id, session_cookie)
        first_day = ((booking_after_day_title.get("travel_plan") or {}).get("days") or [None])[0] or {}
        if first_day.get("title") != "Smoke test day":
            fail("Autosaved travel-plan day title did not persist correctly.")
        log("Verified: valid day title autosaves to the backend.")

        add_item(driver)
        time.sleep(1.2)
        booking_after_empty_item = get_booking(args.backend_port, booking_id, session_cookie)
        if int(booking_after_empty_item.get("travel_plan_revision") or 0) != 1:
            fail("Empty travel-plan item draft unexpectedly autosaved before the required title was filled.")
        log("Verified: empty new travel-plan item does not autosave.")

        set_item_title(driver, "Smoke test travel plan item")
        wait_until(
            lambda: int(get_booking(args.backend_port, booking_id, session_cookie).get("travel_plan_revision") or 0) == 2,
            description="travel-plan item autosave"
        )
        final_booking = get_booking(args.backend_port, booking_id, session_cookie)
        final_day = ((final_booking.get("travel_plan") or {}).get("days") or [None])[0] or {}
        final_item = ((final_day.get("items") or [None])[0]) or {}
        if final_item.get("title") != "Smoke test travel plan item":
            fail("Autosaved travel-plan item title did not persist correctly.")

        status_text = get_status_text(driver)
        if not status_text:
            fail("Travel-plan status text stayed empty after autosave.")

        log(f"Verified: valid travel-plan item title autosaves to the backend. Status: {status_text}")
        log(f"Smoke test passed for booking {booking_id}.")
    finally:
        driver.quit()
        if booking_id and session_cookie and not args.keep_booking:
            delete_booking(args.backend_port, booking_id, session_cookie)


if __name__ == "__main__":
    main()
