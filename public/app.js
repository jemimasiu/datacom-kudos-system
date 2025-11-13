const selectors = {
  form: document.getElementById('kudos-form'),
  recipient: document.getElementById('recipient'),
  message: document.getElementById('message'),
  messageCount: document.getElementById('message-count'),
  feedback: document.querySelector('.form-feedback'),
  feed: document.getElementById('kudos-feed'),
  emptyState: document.getElementById('empty-state'),
  refresh: document.getElementById('refresh'),
  submitButton: document.querySelector('#kudos-form button[type="submit"]')
};

const state = {
  currentUser: null,
  users: [],
  isAdmin: false
};

const formatDate = (isoDate) => {
  const date = new Date(isoDate);
  const formatter = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  });

  return formatter.format(date);
};

const updateMessageCount = () => {
  selectors.messageCount.textContent = selectors.message.value.length;
};

const setFeedback = (text, type) => {
  if (!text) {
    selectors.feedback.hidden = true;
    selectors.feedback.textContent = '';
    selectors.feedback.className = 'form-feedback';
    return;
  }

  selectors.feedback.textContent = text;
  selectors.feedback.hidden = false;
  selectors.feedback.className = `form-feedback ${type}`;
};

const fetchJSON = async (url, options) => {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const error = new Error(payload.error || 'Request failed');
    error.status = response.status;
    throw error;
  }

  return response.json();
};

const populateRecipients = () => {
  selectors.recipient.innerHTML =
    '<option value="" disabled selected>Select a teammate</option>';

  state.users
    .filter((user) => user.id !== state.currentUser?.id)
    .forEach((user) => {
      const option = document.createElement('option');
      option.value = user.id;
      option.textContent = `${user.name} • ${user.title}`;
      selectors.recipient.appendChild(option);
    });
};

const handleHide = async (kudoId) => {
  const reason = prompt('Enter reason for hiding this kudos (optional):');
  if (reason === null) return; // User cancelled

  try {
    await fetchJSON(`/api/kudos/${kudoId}/hide`, {
      method: 'PATCH',
      body: JSON.stringify({ reason: reason.trim() || null })
    });
    setFeedback('Kudos hidden successfully.', 'success');
    await loadKudos();
  } catch (error) {
    console.error(error);
    setFeedback(error.message || 'Failed to hide kudos.', 'error');
  }
};

const handleUnhide = async (kudoId) => {
  try {
    await fetchJSON(`/api/kudos/${kudoId}/unhide`, {
      method: 'PATCH'
    });
    setFeedback('Kudos unhidden successfully.', 'success');
    await loadKudos();
  } catch (error) {
    console.error(error);
    setFeedback(error.message || 'Failed to unhide kudos.', 'error');
  }
};

const handleDelete = async (kudoId) => {
  if (!confirm('Are you sure you want to permanently delete this kudos? This action cannot be undone.')) {
    return;
  }

  try {
    await fetchJSON(`/api/kudos/${kudoId}`, {
      method: 'DELETE'
    });
    setFeedback('Kudos deleted successfully.', 'success');
    await loadKudos();
  } catch (error) {
    console.error(error);
    setFeedback(error.message || 'Failed to delete kudos.', 'error');
  }
};

const renderKudos = (kudosList) => {
  selectors.feed.innerHTML = '';

  if (!kudosList.length) {
    selectors.emptyState.hidden = false;
    return;
  }

  selectors.emptyState.hidden = true;

  kudosList.forEach((item) => {
    const li = document.createElement('li');
    li.className = 'kudos-card';

    const meta = document.createElement('div');
    meta.className = 'kudos-meta';
    meta.innerHTML = `
      <span>From <strong>${item.sender?.name ?? 'Someone'}</strong></span>
      <span>To <strong>${item.recipient?.name ?? 'A teammate'}</strong></span>
      <span>${formatDate(item.createdAt)}</span>
    `;

    const message = document.createElement('p');
    message.className = 'kudos-message';
    message.textContent = item.message;

    li.append(meta, message);

    // Add admin actions if user is admin
    if (state.isAdmin) {
      const adminActions = document.createElement('div');
      adminActions.className = 'admin-actions';
      
      const hideBtn = document.createElement('button');
      hideBtn.type = 'button';
      hideBtn.className = 'admin-button hide-button';
      hideBtn.textContent = item.is_visible ? 'Hide' : 'Unhide';
      hideBtn.onclick = () => item.is_visible ? handleHide(item.id) : handleUnhide(item.id);

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'admin-button delete-button';
      deleteBtn.textContent = 'Delete';
      deleteBtn.onclick = () => handleDelete(item.id);

      adminActions.append(hideBtn, deleteBtn);
      li.appendChild(adminActions);
    }

    selectors.feed.appendChild(li);
  });
};

const loadKudos = async () => {
  try {
    const { kudos } = await fetchJSON('/api/kudos');
    renderKudos(kudos);
  } catch (error) {
    console.error(error);
    setFeedback('Unable to load kudos feed. Please try again later.', 'error');
  }
};

const hydrate = async () => {
  try {
    const [{ user }, { users }, { kudos }] = await Promise.all([
      fetchJSON('/api/current-user'),
      fetchJSON('/api/users'),
      fetchJSON('/api/kudos')
    ]);

    state.currentUser = user;
    state.isAdmin = user.isAdmin || false;
    state.users = [user, ...users];
    populateRecipients();
    renderKudos(kudos);
  } catch (error) {
    console.error(error);
    setFeedback('Unable to load the kudos app. Please refresh the page.', 'error');
    selectors.submitButton.disabled = true;
  }
};

const handleSubmit = async (event) => {
  event.preventDefault();
  setFeedback('', '');

  const recipientId = selectors.recipient.value;
  const message = selectors.message.value.trim();

  if (!recipientId || !message) {
    setFeedback('Please choose a teammate and write a message.', 'error');
    return;
  }

  selectors.submitButton.disabled = true;

  try {
    await fetchJSON('/api/kudos', {
      method: 'POST',
      body: JSON.stringify({ recipientId, message })
    });

    selectors.message.value = '';
    selectors.recipient.value = '';
    updateMessageCount();
    setFeedback('Kudos sent! Nice work spreading positivity.', 'success');
    await loadKudos();
  } catch (error) {
    console.error(error);
    const messageText =
      error.status === 400 || error.status === 404
        ? error.message
        : 'Something went wrong. Please try again.';
    setFeedback(messageText, 'error');
  } finally {
    selectors.submitButton.disabled = false;
  }
};

selectors.message.addEventListener('input', updateMessageCount);
selectors.form.addEventListener('submit', handleSubmit);
selectors.refresh.addEventListener('click', loadKudos);

hydrate();
updateMessageCount();

