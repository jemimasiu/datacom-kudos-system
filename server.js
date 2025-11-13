const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const USERS = [
  { id: 'u0', name: 'Alex Morgan', title: 'Product Manager' },
  { id: 'u1', name: 'Jordan Lee', title: 'Software Engineer' },
  { id: 'u2', name: 'Priya Desai', title: 'UX Designer' },
  { id: 'u3', name: 'Chris Johnson', title: 'DevOps Engineer' },
  { id: 'u4', name: 'Samira Khan', title: 'QA Analyst' },
  { id: 'u5', name: 'Miguel Alvarez', title: 'Customer Success Manager' }
];

const CURRENT_USER_ID = 'u1';
const ADMIN_USER_ID = 'u0'; // Alex Morgan is the admin

// Banned words list (case-insensitive)
const BANNED_WORDS = [
  'spam',
  'test123',
  'inappropriate'
  // Add more banned words as needed
];

const kudosStore = [
  {
    id: 'k1',
    senderId: 'u1',
    recipientId: 'u2',
    message: 'Thanks for the quick turnaround on the prototype updates!',
    createdAt: new Date(new Date().getTime() - 1000 * 60 * 60 * 5).toISOString(),
    is_visible: true,
    moderated_by: null,
    moderated_at: null,
    reason_for_moderation: null
  },
  {
    id: 'k2',
    senderId: 'u3',
    recipientId: 'u1',
    message: 'Appreciate you jumping on the deployment issues last night.',
    createdAt: new Date(new Date().getTime() - 1000 * 60 * 60 * 8).toISOString(),
    is_visible: true,
    moderated_by: null,
    moderated_at: null,
    reason_for_moderation: null
  }
];

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const findUser = (userId) => USERS.find((user) => user.id === userId);

const isAdmin = (userId) => userId === ADMIN_USER_ID;

const escapeHTML = (text) => {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
};

const containsBannedWords = (message) => {
  const lowerMessage = message.toLowerCase();
  return BANNED_WORDS.some((word) => lowerMessage.includes(word.toLowerCase()));
};

const checkDuplicateSubmission = (senderId, recipientId, message, withinSeconds = 60) => {
  const now = Date.now();
  const cutoffTime = now - withinSeconds * 1000;
  
  return kudosStore.some((kudo) => {
    const kudoTime = new Date(kudo.createdAt).getTime();
    return (
      kudo.senderId === senderId &&
      kudo.recipientId === recipientId &&
      kudo.message.trim() === message.trim() &&
      kudoTime > cutoffTime
    );
  });
};

const logModerationAction = (action, kudoId, adminId, reason = null) => {
  console.log(`[MODERATION] ${action} | Kudos: ${kudoId} | Admin: ${adminId} | Reason: ${reason || 'N/A'} | Time: ${new Date().toISOString()}`);
};

app.get('/api/current-user', (_req, res) => {
  const user = findUser(CURRENT_USER_ID);
  res.json({ 
    user: {
      ...user,
      isAdmin: isAdmin(CURRENT_USER_ID)
    }
  });
});

app.get('/api/users', (_req, res) => {
  const colleagues = USERS.filter((user) => user.id !== CURRENT_USER_ID);
  res.json({ users: colleagues });
});

app.get('/api/kudos', (_req, res) => {
  const items = kudosStore
    .filter((kudo) => kudo.is_visible === true)
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map((kudo) => ({
      ...kudo,
      sender: findUser(kudo.senderId),
      recipient: findUser(kudo.recipientId)
    }));

  res.json({ kudos: items });
});

app.post('/api/kudos', (req, res) => {
  const { recipientId, message } = req.body || {};

  if (!recipientId || !message) {
    return res.status(400).json({
      error: 'recipientId and message are required.'
    });
  }

  if (recipientId === CURRENT_USER_ID) {
    return res.status(400).json({ error: 'You cannot send kudos to yourself.' });
  }

  const recipient = findUser(recipientId);
  if (!recipient) {
    return res.status(404).json({ error: 'Recipient not found.' });
  }

  const trimmedMessage = message.trim();
  if (trimmedMessage.length === 0) {
    return res.status(400).json({ error: 'Message cannot be empty.' });
  }

  if (trimmedMessage.length > 500) {
    return res.status(400).json({ error: 'Message must be 500 characters or less.' });
  }

  if (trimmedMessage.length < 1) {
    return res.status(400).json({ error: 'Message must be at least 1 character.' });
  }

  // Check for banned words
  if (containsBannedWords(trimmedMessage)) {
    return res.status(400).json({ error: 'Message contains inappropriate content.' });
  }

  // Check for duplicate submission within 60 seconds
  if (checkDuplicateSubmission(CURRENT_USER_ID, recipientId, trimmedMessage, 60)) {
    return res.status(400).json({ error: 'Duplicate submission detected. Please wait before sending the same message again.' });
  }

  // Sanitize message (HTML escape)
  const sanitizedMessage = escapeHTML(trimmedMessage);

  const newKudo = {
    id: `k${Date.now()}`,
    senderId: CURRENT_USER_ID,
    recipientId,
    message: sanitizedMessage,
    createdAt: new Date().toISOString(),
    is_visible: true,
    moderated_by: null,
    moderated_at: null,
    reason_for_moderation: null
  };

  kudosStore.push(newKudo);

  res.status(201).json({
    kudo: {
      ...newKudo,
      sender: findUser(newKudo.senderId),
      recipient
    }
  });
});

app.patch('/api/kudos/:id/hide', (req, res) => {
  if (!isAdmin(CURRENT_USER_ID)) {
    return res.status(401).json({ error: 'Unauthorized. Admin access required.' });
  }

  const { id } = req.params;
  const { reason } = req.body || {};
  const kudo = kudosStore.find((k) => k.id === id);

  if (!kudo) {
    return res.status(404).json({ error: 'Kudos not found.' });
  }

  kudo.is_visible = false;
  kudo.moderated_by = CURRENT_USER_ID;
  kudo.moderated_at = new Date().toISOString();
  kudo.reason_for_moderation = reason || null;

  logModerationAction('HIDE', id, CURRENT_USER_ID, reason);

  res.json({
    kudo: {
      ...kudo,
      sender: findUser(kudo.senderId),
      recipient: findUser(kudo.recipientId)
    }
  });
});

app.patch('/api/kudos/:id/unhide', (req, res) => {
  if (!isAdmin(CURRENT_USER_ID)) {
    return res.status(401).json({ error: 'Unauthorized. Admin access required.' });
  }

  const { id } = req.params;
  const kudo = kudosStore.find((k) => k.id === id);

  if (!kudo) {
    return res.status(404).json({ error: 'Kudos not found.' });
  }

  kudo.is_visible = true;
  kudo.moderated_by = null;
  kudo.moderated_at = null;
  kudo.reason_for_moderation = null;

  logModerationAction('UNHIDE', id, CURRENT_USER_ID);

  res.json({
    kudo: {
      ...kudo,
      sender: findUser(kudo.senderId),
      recipient: findUser(kudo.recipientId)
    }
  });
});

app.delete('/api/kudos/:id', (req, res) => {
  if (!isAdmin(CURRENT_USER_ID)) {
    return res.status(401).json({ error: 'Unauthorized. Admin access required.' });
  }

  const { id } = req.params;
  const index = kudosStore.findIndex((k) => k.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Kudos not found.' });
  }

  logModerationAction('DELETE', id, CURRENT_USER_ID);
  kudosStore.splice(index, 1);

  res.json({ message: 'Kudos deleted successfully' });
});

app.use((req, res, next) => {
  if (req.method !== 'GET') {
    return next();
  }

  if (req.accepts('html')) {
    return res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }

  return next();
});

app.listen(PORT, () => {
  console.log(`Kudos app listening on http://localhost:${PORT}`);
});

