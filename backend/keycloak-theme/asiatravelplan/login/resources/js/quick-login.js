(function () {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("quick_login") !== "1") {
      return;
    }

    const quickUser = "joachim";
    const quickPassword = "atp";

    const attemptAutoFill = () => {
      const form = document.querySelector("form#kc-form-login, form[name='kc-form-login'], form[action*='login-actions/authenticate']");
      if (!form) {
        return false;
      }

      const usernameInput = document.getElementById("username");
      const passwordInput = document.getElementById("password");
      const submitButton = form.querySelector("button[type='submit'], input[type='submit']");

      if (!usernameInput || !passwordInput) {
        return false;
      }

      usernameInput.focus();
      usernameInput.value = quickUser;
      passwordInput.value = quickPassword;
      usernameInput.dispatchEvent(new Event("input", { bubbles: true }));
      passwordInput.dispatchEvent(new Event("input", { bubbles: true }));

      if (submitButton) {
        submitButton.click();
        return true;
      }

      if (form.requestSubmit) {
        form.requestSubmit();
        return true;
      }

      form.submit();
      return true;
    };

    let attempts = 0;
    const interval = window.setInterval(() => {
      attempts += 1;
      if (attempts > 60 || attemptAutoFill()) {
        window.clearInterval(interval);
      }
    }, 120);
  } catch (_error) {
    // no-op
  }
})();
