const menuButton = document.getElementById("menuButton");
const mobileMenu = document.getElementById("mobileMenu");

if (menuButton && mobileMenu) {
  menuButton.addEventListener("click", () => {
    mobileMenu.classList.toggle("hidden");
  });
}

const faqItems = document.querySelectorAll(".faq-item");

faqItems.forEach((item) => {
  const question = item.querySelector(".faq-question");
  const answer = item.querySelector(".faq-answer");
  const icon = item.querySelector(".faq-icon");

  if (!question || !answer || !icon) return;

  question.addEventListener("click", () => {
    const isOpen = !answer.classList.contains("hidden");

    faqItems.forEach((other) => {
      const otherAnswer = other.querySelector(".faq-answer");
      const otherIcon = other.querySelector(".faq-icon");
      if (otherAnswer && otherIcon) {
        otherAnswer.classList.add("hidden");
        otherIcon.textContent = "+";
      }
    });

    if (!isOpen) {
      answer.classList.remove("hidden");
      icon.textContent = "−";
    }
  });
});
