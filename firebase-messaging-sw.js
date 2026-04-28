// Importa o Firebase (versão compatível para Service Workers)
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Suas chaves exatas do Firebase
firebase.initializeApp({
    apiKey: "AIzaSyBaTEAysfxynSR1BKHdQVv0tGq3JvqafnU",
    authDomain: "nj-imoveis.firebaseapp.com",
    projectId: "nj-imoveis",
    storageBucket: "nj-imoveis.firebasestorage.app",
    messagingSenderId: "424594631604",
    appId: "1:424594631604:web:7b597e6700ddb39183a0e1"
});

const messaging = firebase.messaging();

// Fica escutando as mensagens quando o "App" estiver fechado no celular
messaging.onBackgroundMessage((payload) => {
  console.log('Chegou uma notificação em segundo plano: ', payload);
  
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: './icon.png', // O seu ícone já existente
    badge: './icon.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});