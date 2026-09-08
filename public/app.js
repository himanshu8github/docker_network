document.addEventListener('DOMContentLoaded', () => {
  const messageForm = document.getElementById('message-form');
  const messageInput = document.getElementById('message-input');
  const sendButton = document.getElementById('send-button');
  const messagesList = document.getElementById('messages-list');
  const formFeedback = document.getElementById('form-feedback');

  function showFeedback(text, isError = false) {
    formFeedback.textContent = text;
    formFeedback.className = isError ? 'feedback error' : 'feedback success';
    setTimeout(() => {
      formFeedback.textContent = '';
      formFeedback.className = 'feedback';
    }, 3000);
  }

  async function fetchMessages() {
    try {
      const response = await fetch('/messages');
      if (!response.ok) {
        throw new Error(`Failed to load messages: ${response.statusText}`);
      }

      const messages = await response.json();
      renderMessages(messages);
    } catch (error) {
      messagesList.innerHTML = `<p class="empty-state" style="color: #e53e3e;">Error loading messages: ${error.message}</p>`;
    }
  }

  function renderMessages(messages) {
    if (!messages || messages.length === 0) {
      messagesList.innerHTML = '<p class="empty-state">No messages yet. Send the first message!</p>';
      return;
    }

    messagesList.innerHTML = messages
      .map((item) => {
        const date = new Date(item.createdAt).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        });
        const safeText = escapeHtml(item.message);
        return `
          <div class="message-card">
            <span class="message-text">#${item.id}: ${safeText}</span>
            <span class="message-meta">${date}</span>
          </div>
        `;
      })
      .join('');
  }

  messageForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const text = messageInput.value.trim();
    if (!text) return;

    sendButton.disabled = true;
    try {
      const response = await fetch('/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: text }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Server responded with ${response.status}`);
      }

      messageInput.value = '';
      showFeedback('Message posted successfully!');
      await fetchMessages();
    } catch (error) {
      showFeedback(error.message, true);
    } finally {
      sendButton.disabled = false;
    }
  });

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // Initial fetch on page load
  fetchMessages();
});
