// CẤU HÌNH FIREBASE CHÍNH THỨC
const firebaseConfig = {
  apiKey: "AIzaSyAnIJhlrqnCFZDAre4xiGaxUtDnXsaNWvs",
  authDomain: "schooldatabase-e4cae.firebaseapp.com",
  projectId: "schooldatabase-e4cae",
  storageBucket: "schooldatabase-e4cae.firebasestorage.app",
  messagingSenderId: "798438828630",
  appId: "1:798438828630:web:4dde9f8372ef011a0e69f7"
};

// Đã kích hoạt Firebase
const USE_FIREBASE = true; 

if (typeof module !== 'undefined') {
    module.exports = { firebaseConfig, USE_FIREBASE };
} else {
    window.firebaseConfig = firebaseConfig;
    window.USE_FIREBASE = USE_FIREBASE;
}
