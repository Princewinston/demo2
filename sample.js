// sample.js (Firebase-integrated, notifications enabled, modular)

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, getDocs, setDoc, getDoc,
  updateDoc, deleteDoc, doc, serverTimestamp, addDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  getAuth, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyAvle5UHAFok4ep-brffJNLw-eVp3Xp9XU",
  authDomain: "inventory-tracker-f2581.firebaseapp.com",
  projectId: "inventory-tracker-f2581",
  storageBucket: "inventory-tracker-f2581.appspot.com",
  messagingSenderId: "1076860596942",
  appId: "1:1076860596942:web:e53b86f1f938f3fd219e07"
};

// Init
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
let currentUser = null;

// Notification
function showNotification(message, type = "success") {
  const notif = document.createElement("div");
  notif.className = `notification ${type}`;
  notif.textContent = message;
  document.body.appendChild(notif);
  setTimeout(() => notif.remove(), 3000);
}

// Auth Guard
onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
  } else {
    window.location.href = "index.html";
  }
});

// Logout
window.logout = function () {
  signOut(auth)
    .then(() => window.location.href = "index.html")
    .catch((err) => showNotification("Logout failed: " + err.message, "error"));
};

// Log activity
async function logActivity(user, action, details) {
  try {
    await addDoc(collection(db, "activity_logs"), {
      user: user || "Anonymous",
      action,
      details,
      timestamp: serverTimestamp()
    });
  } catch (error) {
    console.error("Logging error:", error);
  }
}

// Status formatter
function getStatus(stock, reorder) {
  if (stock === 0) return '<span class="status-out">Out of Stock</span>';
  if (stock <= reorder) return '<span class="status-low">Low Stock</span>';
  return '<span class="status-sufficient">Sufficient</span>';
}

function formatDate(timestamp) {
  if (!timestamp) return "N/A";
  const date = timestamp.toDate();
  return date.toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric"
  }) + " " + date.toLocaleTimeString("en-US", {
    hour: "2-digit", minute: "2-digit"
  });
}

// Load inventory
async function loadInventory() {
  const tbody = document.getElementById("productTableBody");
  tbody.innerHTML = "";

  const snapshot = await getDocs(collection(db, "inventory"));
  snapshot.forEach((docSnap) => {
    const item = docSnap.data();
    item.docId = docSnap.id;

    const tr = document.createElement("tr");
    tr.innerHTML = `
  <td>${item.name}</td>
  <td>${item.id}</td>
  <td>${item.stock}</td>
  <td>${item.reorder}</td>
  <td>${getStatus(item.stock, item.reorder)}</td>
  <td>${formatDate(item.updated)}</td>
  <td class="actions">
  <div class="action-buttons">
    <button class="add-btn">➕ Add</button>
    <button class="remove-btn">➖ Remove</button>
    <button class="edit-btn">✏️ Edit</button>
    <button class="delete-btn">🗑️</button>
  </div>
</td>
`;


    tr.querySelector(".add-btn").addEventListener("click", () => showInputRow(tr, item, 1));
    tr.querySelector(".remove-btn").addEventListener("click", () => showInputRow(tr, item, -1));
   tr.querySelector(".delete-btn").addEventListener("click", async () => {
  if (confirm(`Delete ${item.name}?`)) {
    await deleteDoc(doc(db, "inventory", item.docId));
    await logActivity(currentUser.email, "Deleted Product", `Deleted ${item.name} (ID: ${item.id})`);
    
    showNotification("✅ Product deleted successfully!", "success");  // ✅ Fixed here
    loadInventory();
  }
  });
  tr.querySelector(".edit-btn").addEventListener("click", () => {
  if (document.querySelector(".input-row")) return showNotification("Finish current action first", "warning");

  const editRow = document.createElement("tr");
  editRow.className = "input-row";
  const td = document.createElement("td");
  td.colSpan = 7;

  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.value = item.name;
  nameInput.placeholder = "Product Name";
  nameInput.style.marginRight = "8px";

  const stockInput = document.createElement("input");
  stockInput.type = "number";
  stockInput.value = item.stock;
  stockInput.style.marginRight = "8px";

  const reorderInput = document.createElement("input");
  reorderInput.type = "number";
  reorderInput.value = item.reorder;
  reorderInput.style.marginRight = "8px";

  const saveBtn = document.createElement("button");
saveBtn.textContent = "💾 Save";
saveBtn.className = "btn-primary";

const cancelBtn = document.createElement("button");
cancelBtn.textContent = "❌ Cancel";
cancelBtn.className = "btn-cancel";


  td.append(nameInput, stockInput, reorderInput, saveBtn, cancelBtn);
  editRow.appendChild(td);
  tr.after(editRow);

  cancelBtn.addEventListener("click", () => editRow.remove());

  saveBtn.addEventListener("click", async () => {
  const newName = nameInput.value.trim();
  const newStock = parseInt(stockInput.value);
  const newReorder = parseInt(reorderInput.value);

  if (!newName || isNaN(newStock) || isNaN(newReorder)) {
    return showNotification("Invalid input", "warning");
  }

  const changes = [];

  if (newName !== item.name) {
    changes.push(`Name: '${item.name}' → '${newName}'`);
  }
  if (newStock !== item.stock) {
    changes.push(`Stock: ${item.stock} → ${newStock}`);
  }
  if (newReorder !== item.reorder) {
    changes.push(`Reorder Level: ${item.reorder} → ${newReorder}`);
  }

  if (changes.length === 0) {
    showNotification("No changes made", "warning");
    return;
  }

  try {
    await updateDoc(doc(db, "inventory", item.docId), {
      name: newName,
      stock: newStock,
      reorder: newReorder,
      updated: serverTimestamp()
    });

    const detailLog = changes.join(", ");
    await logActivity(currentUser.email, "Edited Product", `ID: ${item.id} → ${detailLog}`);
    showNotification("✅ Product updated successfully!");
    editRow.remove();
    loadInventory();
  } catch (err) {
    console.error("Edit failed:", err);
    showNotification("Error updating product", "error");
  }
});

});



    tbody.appendChild(tr);
  });
}

// Add product
const form = document.getElementById("addForm");
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("pid").value.trim();
  const name = document.getElementById("pname").value.trim();
  const stock = parseInt(document.getElementById("pstock").value);
  const reorder = parseInt(document.getElementById("preorder").value);

 if (!id || !name || isNaN(stock) || isNaN(reorder)) {
  showNotification("❗ Please fill all fields correctly.", "warning");
  return;
}

const productRef = doc(db, "inventory", id);
try {
  const existing = await getDoc(productRef);

  if (existing.exists()) {
    showNotification("❗ Product ID already exists! Please use a unique ID.", "warning");
    return; // 🔒 stop submission
  }

  await setDoc(productRef, {
    id, name, stock, reorder,
    updated: serverTimestamp()
  });

  await logActivity(currentUser.email, "Add Product", `Added ${stock} units of ${name} (ID: ${id})`);
  showNotification("✅ Product added successfully!");
  form.reset();
  loadInventory();
} catch (err) {
  console.error("Add error:", err);
  showNotification("❌ Failed to add product.", "error");
}


  try {
    await setDoc(productRef, {
      id, name, stock, reorder,
      updated: serverTimestamp()
    });

    await logActivity(currentUser.email, "Add Product", `Added ${stock} units of ${name} (ID: ${id})`);
    showNotification("✅ Product added successfully!");
    form.reset();
    loadInventory();
  } catch (err) {
    console.error("Add error:", err);
    showNotification("❌ Failed to add product.", "error");
  }
});

// Add/remove stock
function showInputRow(row, item, mode) {
  if (document.querySelector(".input-row")) return;

  const inputRow = document.createElement("tr");
  inputRow.className = "input-row";
  const td = document.createElement("td");
  td.colSpan = 7;

  const input = document.createElement("input");
  input.type = "number";
  input.placeholder = mode === 1 ? "Enter quantity to add" : "Enter quantity to remove";
  input.style.marginRight = "10px";

  const confirm = document.createElement("button");
confirm.textContent = "✅ Confirm";
confirm.className = "btn-primary";

const cancel = document.createElement("button");
cancel.textContent = "❌ Cancel";
cancel.className = "btn-cancel";


  td.append(input, confirm, cancel);
  inputRow.appendChild(td);
  row.after(inputRow);

  confirm.addEventListener("click", async () => {
    const qty = parseInt(input.value);
    if (isNaN(qty) || qty <= 0) return showNotification("Enter a valid quantity", "warning");

    const newStock = item.stock + mode * qty;
    if (newStock < 0) return showNotification("Stock can't go below 0", "error");

    try {
      await updateDoc(doc(db, "inventory", item.docId), {
        stock: newStock,
        updated: serverTimestamp()
      });

      await logActivity(currentUser.email, mode === 1 ? "Added Stock" : "Removed Stock", `${mode === 1 ? "Added" : "Removed"} ${qty} units of ${item.name} (ID: ${item.id})`);
      showNotification(mode === 1 ? "Stock added successfully" : "Stock removed", mode === 1 ? "success" : "warning");
      inputRow.remove();
      loadInventory();
    } catch (err) {
      showNotification("Error updating stock", "error");
    }
  });

  cancel.addEventListener("click", () => inputRow.remove());
}

// Auto-uppercase Product ID
const pidInput = document.getElementById("pid");
pidInput.addEventListener("input", function () {
  this.value = this.value.toUpperCase();
});

// 🔒 Prevent duplicate product ID before form submit
pidInput.addEventListener("blur", async function () {
  const pid = this.value.trim();
  const submitBtn = form.querySelector("button[type='submit']");
  if (!pid) return;

  const checkRef = doc(db, "inventory", pid);
  const docSnap = await getDoc(checkRef);

  if (docSnap.exists()) {
    showNotification("❗ Product ID already exists! Choose a new one.", "warning");
    submitBtn.disabled = true;
  } else {
    submitBtn.disabled = false;
  }
});


// Search bar
const searchInput = document.querySelector(".search input");
searchInput.addEventListener("input", function () {
  const keyword = this.value.toLowerCase();
  const rows = document.querySelectorAll("#productTableBody tr");
  rows.forEach((row) => {
    const pname = row.children[0].textContent.toLowerCase();
    const pid = row.children[1].textContent.toLowerCase();
    row.style.display = pname.includes(keyword) || pid.includes(keyword) ? "" : "none";
  });
});

// Load on startup
loadInventory();