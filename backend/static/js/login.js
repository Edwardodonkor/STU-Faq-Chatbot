document.getElementById("loginForm").addEventListener("submit", function (e) {
    e.preventDefault();
  
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();
    const loginError = document.getElementById("loginError");
  
    if (username === "Stu-Bot" && password === "adminbot123") {
      window.location.href = "admin-dashboard.html";
    } else {
      loginError.innerHTML = "Invalid username or password.";
    }
  });
  