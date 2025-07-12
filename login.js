function login() {
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;

  if (username === "admin" && password === "1234") {
    localStorage.setItem("loggedIn", "true");
    window.location.href = "home.html"; 
  } else {
    document.getElementById("error-msg").textContent = "Invalid username or password.";
  }
}
