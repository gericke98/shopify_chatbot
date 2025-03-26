(function () {
  const config = window.SHAMELESS_CHAT_CONFIG;
  if (!config) return;

  const widget = document.getElementById("shameless-chat-widget");
  if (!widget) return;

  // Create iframe
  const iframe = document.createElement("iframe");
  iframe.style.width = "100%";
  iframe.style.height = "100%";
  iframe.style.border = "none";
  iframe.src = `https://shopify-chatbot-two.vercel.app/embed?shop=${config.shop}`;
  widget.appendChild(iframe);

  // Create chat button
  const button = document.createElement("button");
  button.className = "shameless-chat-button";
  button.innerHTML = `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2Z" fill="white"/>
      <path d="M12 6C10.9 6 10 6.9 10 8C10 9.1 10.9 10 12 10C13.1 10 14 9.1 14 8C14 6.9 13.1 6 12 6Z" fill="#4F46E5"/>
      <path d="M12 12C10.9 12 10 12.9 10 14C10 15.1 10.9 16 12 16C13.1 16 14 15.1 14 14C14 12.9 13.1 12 12 12Z" fill="#4F46E5"/>
    </svg>
  `;
  button.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 60px;
    height: 60px;
    border-radius: 50%;
    background: #4F46E5;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
    z-index: 9999;
    transition: transform 0.2s;
  `;

  button.addEventListener("mouseover", () => {
    button.style.transform = "scale(1.1)";
  });

  button.addEventListener("mouseout", () => {
    button.style.transform = "scale(1)";
  });

  button.addEventListener("click", () => {
    widget.classList.toggle("active");
    button.style.display = widget.classList.contains("active")
      ? "none"
      : "flex";
  });

  document.body.appendChild(button);
})();
