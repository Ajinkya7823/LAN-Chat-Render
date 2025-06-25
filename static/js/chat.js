let socket = io();
let currentRecipients = null;
let groupUsers = [];

// Store drafts per chat
let chatDrafts = {};

function scrollChatToBottom() {
  let chatBody = document.getElementById('chat-body');
  chatBody.scrollTop = chatBody.scrollHeight;
}

function renderMessage(msg, isLatest = false) {
  let fileHtml = '';
  if (msg.file) {
    if (msg.file.mimetype.startsWith('image/')) {
      fileHtml = `<div><img src="/uploads/${msg.file.filename}" style="max-width:200px;" class="img-thumbnail"></div>`;
    } else if (msg.file.mimetype.startsWith('video/')) {
      fileHtml = `<div><video controls style="max-width:200px;"><source src="/uploads/${msg.file.filename}" type="${msg.file.mimetype}"></video></div>`;
    } else if (msg.file.mimetype.startsWith('audio/')) {
      fileHtml = `<div><audio controls style='max-width:200px;'><source src="/uploads/${msg.file.filename}" type="${msg.file.mimetype}"></audio></div>`;
    } else {
      fileHtml = `<div><a href="/uploads/${msg.file.filename}" target="_blank">${msg.file.original_name}</a></div>`;
    }
  }
  let msgClass = '';
  let deleteBtn = '';
  // Show delete button for all messages (own and friend's)
  deleteBtn = `<button class='btn btn-link text-danger btn-sm delete-msg-btn' data-msg-id='${msg.id}' title='Delete'><i class='bi bi-trash'></i></button>`;
  // Reply button
  let replyBtn = `<button class='btn btn-link text-primary btn-sm reply-msg-btn' data-msg-id='${msg.id}' title='Reply'><i class='bi bi-reply'></i></button>`;
  // React button
  let reactBtn = `<button class='btn btn-link text-warning btn-sm react-msg-btn' data-msg-id='${msg.id}' title='React'><i class='bi bi-emoji-smile'></i></button>`;
  let ticks = '';
  if (msg.sender === USERNAME) {
    msgClass = 'mine';
    // WhatsApp-like ticks
    if (msg.status === 'read') {
      ticks = `<span class='msg-ticks'><i class='bi bi-check2-all' style='color:#2196f3;font-size:1.2em;'></i></span>`;
    } else {
      ticks = `<span class='msg-ticks'><i class='bi bi-check2' style='color:#222;font-size:1.2em;'></i></span>`;
    }
  } else if (
    (currentRecipients === msg.sender) ||
    (currentRecipients === msg.recipients) ||
    (msg.recipients.split(',').includes(USERNAME) && currentRecipients)
  ) {
    msgClass = 'theirs';
    // Mark as read if not already
    if (msg.status !== 'read') {
      socket.emit('message_read', {msg_id: msg.id});
    }
  }
  if (isLatest) msgClass += ' latest';
  // Show reply preview if this is a reply
  let replyHtml = '';
  if (msg.reply_to) {
    let r = msg.reply_to;
    replyHtml = `<div class='reply-preview border rounded p-1 mb-1' style='background:#f1f1f1;font-size:0.95em;'><b>${r.sender}:</b> ${r.content}</div>`;
  }
  // Show reactions
  let reactionsHtml = '';
  if (msg.reactions && Object.keys(msg.reactions).length > 0) {
    reactionsHtml = `<div class='reactions-bar mt-1'>`;
    for (const [emoji, users] of Object.entries(msg.reactions)) {
      let reacted = users.includes(USERNAME) ? 'reacted' : '';
      reactionsHtml += `<span class='reaction ${reacted}' data-msg-id='${msg.id}' data-emoji='${emoji}' title='${users.join(', ')}'>${emoji} <span class='reaction-count'>${users.length}</span></span> `;
    }
    reactionsHtml += `</div>`;
  }
  let html = `<div class="message-wrapper">
    <div class="message ${msgClass}" data-msg-id="${msg.id}">
      <div class="msg-header-row">
        <span class="sender">${msg.sender}</span>
        <span class="msg-actions">${replyBtn}${reactBtn}${deleteBtn}</span>
      </div>
      ${replyHtml}
      <div class="msg-content">${msg.content || ''}</div>
      ${fileHtml}
      ${reactionsHtml}
      ${ticks}
    </div>
    <span class="timestamp${isLatest ? ' always' : ''}">${msg.timestamp}</span>
  </div>`;
  $('#chat-body').append(html);
  scrollChatToBottom();
}

function loadHistory(filter) {
  $('#chat-body').html('<div class="text-center text-muted">Loading...</div>');
  $.get('/history', {user: filter}, function(data) {
    $('#chat-body').empty();
    data.forEach(function(msg, idx) {
      renderMessage(msg, idx === data.length - 1);
    });
  });
}

// Remove updateUserList(users) and instead use only /users_status as the source of truth
function updateUserListFromStatus(statusList) {
  let ul = $('#user-list');
  ul.empty();
  statusList.forEach(u => {
    if (u.username === USERNAME) return; // Skip current user
    let badge = `<span class="badge bg-danger ms-auto" id="badge-${u.username}" style="display:none;">0</span>`;
    let statusClass = u.online ? 'status-online' : 'status-offline';
    let dot = `<span class="status-dot ${statusClass}"></span>`;
    let li = $(`<li class="list-group-item user-item d-flex align-items-center justify-content-between" data-user="${u.username}">${dot}<span class="ms-2">${u.username}</span>${badge}</li>`);
    ul.append(li);
  });
  let groupSel = $('#group-users');
  groupSel.empty();
  statusList.forEach(u => {
    if (u.username !== USERNAME) groupSel.append(`<option value="${u.username}">${u.username}</option>`);
  });
}

// Notification badge logic
function showBadge(user) {
  if (user !== USERNAME) {
    let badge = $(`#badge-${user}`);
    let count = parseInt(badge.attr('data-count')) || 0;
    count++;
    badge.attr('data-count', count);
    badge.text(count === 1 ? 'NEW' : count);
    badge.show();
  }
}
function clearBadge(user) {
  let badge = $(`#badge-${user}`);
  badge.attr('data-count', 0);
  badge.text('');
  badge.hide();

  
}

// Show badge for group
function showGroupBadge(groupId) {
  let badge = $(`#group-list .group-item[data-group-id='${groupId}'] .group-badge`);
  let count = parseInt(badge.attr('data-count')) || 0;
  count++;
  badge.attr('data-count', count);
  badge.text(count === 1 ? 'NEW' : count);
  badge.show();
}
// Clear badge for group
function clearGroupBadge(groupId) {
  let badge = $(`#group-list .group-item[data-group-id='${groupId}'] .group-badge`);
  badge.attr('data-count', 0);
  badge.text('');
  badge.hide();
}

// Typing indicator logic
let typingTimeout;
let lastTypedRecipient = null;
$('#message-input').on('input', function() {
  if (!currentRecipients) return;
  if (lastTypedRecipient !== currentRecipients) {
    lastTypedRecipient = currentRecipients;
  }
  socket.emit('typing', {to: currentRecipients});
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(function() {
    socket.emit('stop_typing', {to: currentRecipients});
  }, 1500);
});

socket.on('show_typing', function(data) {
  if (currentRecipients === data.from || currentRecipients === data.room) {
    if ($('#typing-indicator').length === 0) {
      $('#chat-body').append('<div id="typing-indicator" class="text-muted" style="margin:8px 0 0 8px;">Typing...</div>');
      scrollChatToBottom();
    }
  }
});
socket.on('hide_typing', function(data) {
  $('#typing-indicator').remove();
});

$(function() {
  socket.emit('join', {room: USERNAME});
  $('#chat-body').html('<div class="text-center text-muted">Select a user or group to start chatting.</div>');
  // Use /users_status for initial user list
  $.get('/users_status', updateUserListFromStatus);

  // Listen for user_list and refresh from /users_status
  socket.on('user_list', function() {
    $.get('/users_status', updateUserListFromStatus);
  });

  socket.on('receive_message', function(msg) {
    // If the message is for the current open chat, render it
    if (
      (currentRecipients === msg.sender && msg.recipients === USERNAME) ||
      (currentRecipients === msg.recipients && msg.sender === USERNAME) ||
      (msg.recipients.split(',').includes(USERNAME) && currentRecipients === msg.sender) ||
      // Fix: show group message in real time if viewing that group
      (currentRecipients && currentRecipients.startsWith('group-') && currentRecipients === msg.recipients)
    ) {
      renderMessage(msg);
    }
    // Show badge if the message is for this user, from another user, and not currently open chat
    if (
      msg.recipients.split(',').includes(USERNAME) &&
      msg.sender !== USERNAME &&
      currentRecipients !== msg.sender
    ) {
      showBadge(msg.sender);
      // --- Move user to top of user list ---
      let userItem = $("#user-list .user-item[data-user='" + msg.sender + "']");
      if (userItem.length) {
        userItem.prependTo('#user-list');
      }
    }
    // Show group badge if group message and not currently open
    if (
      msg.recipients.startsWith('group-') &&
      msg.sender !== USERNAME &&
      currentRecipients !== msg.recipients
    ) {
      // Extract group id (handle both 'group-<id>' and 'group-<name>' formats)
      let groupId = msg.recipients.replace('group-', '');
      // Try to match by data-group-id (which is a number)
      let groupItem = $("#group-list .group-item[data-group-id='" + groupId + "']");
      // If not found, try to find by partial match (for group names)
      if (!groupItem.length) {
        groupItem = $("#group-list .group-item").filter(function() {
          return msg.recipients === 'group-' + $(this).data('group-id');
        });
      }
      showGroupBadge(groupId);
      if (groupItem.length) {
        groupItem.prependTo('#group-list');
      }
    }
    // Show notification if message is for this user and not from self, and window is not focused
    if (
      msg.recipients.split(',').includes(USERNAME) &&
      msg.sender !== USERNAME &&
      !document.hasFocus()
    ) {
      console.log('Attempting to show notification:', msg);
      showBrowserNotification(msg);
    }
  });

  socket.on('message_read', function(data) {
    const msgId = data.msg_id;
    // Update all matching ticks in the DOM, even if chat is not open
    $(".message[data-msg-id='" + msgId + "'] .msg-ticks").html("<i class='bi bi-check2-all' style='color:#2196f3;font-size:1.2em;'></i>");
  });

  function saveCurrentDraft() {
    if (currentRecipients) {
      chatDrafts[currentRecipients] = {
        text: $('#message-input').val(),
        file: $('#file-input')[0].files[0] || null
      };
    }
  }

  function restoreDraftFor(recipient) {
    const draft = chatDrafts[recipient] || {text: '', file: null};
    $('#message-input').val(draft.text || '');
    if (draft.file) {
      // Restore file input (workaround: create a new FileList is not possible, so just show name)
      $('#file-name').text(draft.file.name);
      $('#file-preview').html(''); // Optionally, preview logic can be added
    } else {
      $('#file-input').val('');
      $('#file-name').text('No file');
      $('#file-preview').html('');
    }
  }

  $('#user-list').on('click', '.user-item', function() {
    saveCurrentDraft();
    $('#user-list .user-item').removeClass('active animated-select');
    $(this).addClass('active animated-select');
    let user = $(this).data('user');
    if (user === USERNAME) return;
    currentRecipients = user;
    groupUsers = [];
    $('#chat-title').text('Chat with ' + user);
    loadHistory(user);
    clearBadge(user);
    restoreDraftFor(user);
  });

  $('#start-group').click(function() {
    saveCurrentDraft();
    groupUsers = $('#group-users').val() || [];
    if (groupUsers.length > 0) {
      groupUsers.push(USERNAME);
      groupUsers = [...new Set(groupUsers)].sort();
      let groupRoom = 'group-' + groupUsers.join('-');
      currentRecipients = groupRoom;
      socket.emit('join', {room: groupRoom});
      $('#chat-title').text('Group: ' + groupUsers.filter(u => u !== USERNAME).join(', '));
      loadHistory(groupRoom);
      restoreDraftFor(groupRoom);
    }
  });

  $('#show-history').click(function() {
    loadHistory(USERNAME);
  });

  // Remove ALL previous submit handlers and only use ONE
  $('#message-form').off('submit');
  // Only keep this single handler:
  $('#message-form').on('submit', function(e) {
    e.preventDefault();
    let content = $('#message-input').val();
    let file = $('#file-input')[0].files[0];
    // Prevent sending if all are empty (text, file, audio)
    if (!content && !file && !audioBlob) return;
    let data = {
      recipients: currentRecipients,
      content: content
    };
    if (replyToMsgId) data.reply_to = replyToMsgId;
    if (file) {
      let formData = new FormData();
      formData.append('file', file);
      $('#file-name').text('Uploading...');
      $('#message-form button[type="submit"]').prop('disabled', true);
      $.ajax({
        url: '/upload',
        type: 'POST',
        data: formData,
        processData: false,
        contentType: false,
        success: function(resp) {
          if (resp.file_id) {
            data.file_id = resp.file_id;
            socket.emit('send_message', data);
          } else {
            alert('File upload failed.');
          }
        },
        error: function(xhr) {
          alert('File upload failed: ' + (xhr.responseJSON?.error || 'Unknown error'));
        },
        complete: function() {
          $('#file-input').val('');
          $('#file-name').text('No file');
          $('#file-preview').html('');
          $('#message-input').val('');
          replyToMsgId = null;
          $('#reply-preview-bar').remove();
          $('#message-form button[type="submit"]').prop('disabled', false);
        }
      });
    } else if (audioBlob) {
      let formData = new FormData();
      formData.append('file', audioBlob, 'audio_message.webm');
      $('#audio-record-status').text('Uploading...');
      $.ajax({
        url: '/upload',
        type: 'POST',
        data: formData,
        processData: false,
        contentType: false,
        success: function(resp) {
          if (resp.file_id) {
            data.file_id = resp.file_id;
            socket.emit('send_message', data);
          } else {
            alert('Audio upload failed.');
          }
        },
        error: function(xhr) {
          alert('Audio upload failed: ' + (xhr.responseJSON?.error || 'Unknown error'));
        },
        complete: function() {
          audioBlob = null;
          $('#audio-preview').hide().attr('src', '');
          $('#audio-record-status').hide();
          $('#cancel-audio-btn').remove();
          $('#message-input').val('');
          replyToMsgId = null;
          $('#reply-preview-bar').remove();
        }
      });
    } else {
      socket.emit('send_message', data);
      $('#message-input').val('');
      $('#file-input').val('');
      $('#file-name').text('No file');
      $('#file-preview').html('');
      replyToMsgId = null;
      $('#reply-preview-bar').remove();
    }
    if (currentRecipients) chatDrafts[currentRecipients] = {text: '', file: null};
  });

  // Delete message handler
  $(document).on('click', '.delete-msg-btn', function() {
    if (!confirm('Delete this message?')) return;
    let msgId = $(this).data('msg-id');
    let msgDiv = $(this).closest('.message');
    $.post(`/delete_message/${msgId}`, function(resp) {
      if (resp.success) {
        msgDiv.remove();
      } else {
        alert(resp.error || 'Delete failed');
      }
    });
  });

  $('#file-input').on('change', function() {
    const file = this.files[0];
    const fileName = file ? file.name : 'No file';
    $('#file-name').text(fileName);
    let preview = '';
    if (file) {
      if (file.type.startsWith('image/')) {
        const url = URL.createObjectURL(file);
        preview = `<img src='${url}' style='max-width:40px;max-height:40px;border-radius:6px;margin-left:4px;'>`;
      } else if (file.type.startsWith('video/')) {
        preview = `<i class='bi bi-film' style='font-size:1.3em;margin-left:4px;'></i>`;
      } else if (file.type.includes('pdf')) {
        preview = `<i class='bi bi-file-earmark-pdf' style='font-size:1.3em;margin-left:4px;color:#d32f2f;'></i>`;
      } else if (file.type.includes('zip') || file.type.includes('rar') || file.type.includes('7z')) {
        preview = `<i class='bi bi-file-earmark-zip' style='font-size:1.3em;margin-left:4px;color:#f0ad4e;'></i>`;
      } else if (file.type.startsWith('audio/')) {
        preview = `<i class='bi bi-music-note-beamed' style='font-size:1.3em;margin-left:4px;color:#007bff;'></i>`;
      } else {
        preview = `<i class='bi bi-file-earmark' style='font-size:1.3em;margin-left:4px;'></i>`;
      }
      // Add cancel button
      preview += ` <button type='button' id='cancel-file-btn' class='btn btn-sm btn-outline-danger ms-2' title='Cancel'><i class='bi bi-x'></i></button>`;
    }
    $('#file-preview').html(preview);
  });

  // Cancel file selection
  $(document).on('click', '#cancel-file-btn', function() {
    // Replace file input with a fresh clone to ensure change event always fires
    const $oldInput = $('#file-input');
    const $newInput = $oldInput.clone().val('');
    $oldInput.replaceWith($newInput);
    $newInput.on('change', function() {
      const file = this.files[0];
      const fileName = file ? file.name : 'No file';
      $('#file-name').text(fileName);
      let preview = '';
      if (file) {
        if (file.type.startsWith('image/')) {
          const url = URL.createObjectURL(file);
          preview = `<img src='${url}' style='max-width:40px;max-height:40px;border-radius:6px;margin-left:4px;'>`;
        } else if (file.type.startsWith('video/')) {
          preview = `<i class='bi bi-film' style='font-size:1.3em;margin-left:4px;'></i>`;
        } else if (file.type.includes('pdf')) {
          preview = `<i class='bi bi-file-earmark-pdf' style='font-size:1.3em;margin-left:4px;color:#d32f2f;'></i>`;
        } else if (file.type.includes('zip') || file.type.includes('rar') || file.type.includes('7z')) {
          preview = `<i class='bi bi-file-earmark-zip' style='font-size:1.3em;margin-left:4px;color:#f0ad4e;'></i>`;
        } else if (file.type.startsWith('audio/')) {
          preview = `<i class='bi bi-music-note-beamed' style='font-size:1.3em;margin-left:4px;color:#007bff;'></i>`;
        } else {
          preview = `<i class='bi bi-file-earmark' style='font-size:1.3em;margin-left:4px;'></i>`;
        }
        preview += ` <button type='button' id='cancel-file-btn' class='btn btn-sm btn-outline-danger ms-2' title='Cancel'><i class='bi bi-x'></i></button>`;
      }
      $('#file-preview').html(preview);
    });
    $('#file-name').text('No file');
    $('#file-preview').html('');
    // Remove file from draft if using per-chat drafts
    if (currentRecipients && chatDrafts) {
      chatDrafts[currentRecipients] = chatDrafts[currentRecipients] || {text: '', file: null};
      chatDrafts[currentRecipients].file = null;
    }
  });

  $('#message-input').on('input', function() {
    // Save text draft for current chat
    if (currentRecipients) {
      chatDrafts[currentRecipients] = chatDrafts[currentRecipients] || {text: '', file: null};
      chatDrafts[currentRecipients].text = $(this).val();
    }
  });
});

// Request notification permission on page load
if (window.Notification && Notification.permission !== 'granted') {
  Notification.requestPermission();
}

function showBrowserNotification(msg) {
  if (window.Notification && Notification.permission === 'granted') {
    let body = msg.content ? msg.content : (msg.file ? 'Sent a file' : '');
    let notification = new Notification('New message from ' + msg.sender, {
      body: body,
      icon: '/static/icons/favicon.ico' // Optional: set your favicon or chat icon
    });
    notification.onclick = function() {
      window.focus();
      this.close();
    };
  }
}

// --- Reply and React Handlers ---
let replyToMsgId = null;

// Reply button click
$(document).on('click', '.reply-msg-btn', function() {
  const msgId = $(this).data('msg-id');
  const msgDiv = $(this).closest('.message');
  const msgSender = msgDiv.find('.sender').text();
  const msgContent = msgDiv.find('.msg-content').text();
  replyToMsgId = msgId;
  // Show reply preview above input
  if ($('#reply-preview-bar').length === 0) {
    $('#message-form').prepend(`<div id='reply-preview-bar' class='alert alert-secondary py-1 px-2 mb-2 d-flex align-items-center justify-content-between'>
      <span><b>Replying to ${msgSender}:</b> ${msgContent}</span>
      <button type='button' class='btn btn-sm btn-outline-danger ms-2' id='cancel-reply-btn'><i class='bi bi-x'></i></button>
    </div>`);
  } else {
    $('#reply-preview-bar span').html(`<b>Replying to ${msgSender}:</b> ${msgContent}`);
  }
});
// Cancel reply
$(document).on('click', '#cancel-reply-btn', function() {
  replyToMsgId = null;
  $('#reply-preview-bar').remove();
});

// React button click (show emoji picker)
$(document).on('click', '.react-msg-btn', function(e) {
  e.stopPropagation();
  const msgId = $(this).data('msg-id');
  // Simple emoji picker (customize as needed)
  const emojis = ['👍','😂','❤️','😮','😢','🙏'];
  let picker = `<div class='emoji-picker border rounded bg-white p-2' style='position:absolute;z-index:10;'>`;
  emojis.forEach(emoji => {
    picker += `<span class='emoji-option' data-msg-id='${msgId}' data-emoji='${emoji}' style='font-size:1.5em;cursor:pointer;margin:0 4px;'>${emoji}</span>`;
  });
  picker += `</div>`;
  // Remove any existing picker
  $('.emoji-picker').remove();
  $(this).parent().append(picker);
});
// Click emoji to react
$(document).on('click', '.emoji-option', function(e) {
  e.stopPropagation();
  const msgId = $(this).data('msg-id');
  const emoji = $(this).data('emoji');
  socket.emit('react_message', {msg_id: msgId, emoji: emoji});
  $('.emoji-picker').remove();
});
// Remove reaction on click (if already reacted)
$(document).on('click', '.reaction.reacted', function(e) {
  e.stopPropagation();
  const msgId = $(this).data('msg-id');
  const emoji = $(this).data('emoji');
  socket.emit('remove_reaction', {msg_id: msgId, emoji: emoji});
});
// Hide emoji picker on outside click
$(document).on('click', function(e) {
  if (!$(e.target).closest('.emoji-picker, .react-msg-btn').length) {
    $('.emoji-picker').remove();
  }
});
// --- END Reply and React Handlers ---

// Update reactions in real time
socket.on('update_reactions', function(data) {
  const msgId = data.msg_id;
  const reactions = data.reactions;
  const msgDiv = $(`.message[data-msg-id='${msgId}']`);
  let reactionsHtml = '';
  if (reactions && Object.keys(reactions).length > 0) {
    reactionsHtml = `<div class='reactions-bar mt-1'>`;
    for (const [emoji, users] of Object.entries(reactions)) {
      let reacted = users.includes(USERNAME) ? 'reacted' : '';
      reactionsHtml += `<span class='reaction ${reacted}' data-msg-id='${msgId}' data-emoji='${emoji}' title='${users.join(', ')}'>${emoji} <span class='reaction-count'>${users.length}</span></span> `;
    }
    reactionsHtml += `</div>`;
  }
  msgDiv.find('.reactions-bar').remove();
  if (reactionsHtml) msgDiv.append(reactionsHtml);
});

// --- Audio Recording ---
let mediaRecorder = null;
let audioChunks = [];
let audioBlob = null;

$(document).on('click', '#audio-record-btn', function() {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
    $('#audio-record-status').text('Processing...').show();
    return;
  }
  navigator.mediaDevices.getUserMedia({ audio: true }).then(function(stream) {
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];
    mediaRecorder.ondataavailable = function(e) {
      if (e.data.size > 0) audioChunks.push(e.data);
    };
    mediaRecorder.onstop = function() {
      audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      const url = URL.createObjectURL(audioBlob);
      $('#audio-preview').attr('src', url).show();
      $('#audio-record-status').text('Audio ready!').show();
      // Show cancel button
      if ($('#cancel-audio-btn').length === 0) {
        $('#audio-record-area').append(`<button type='button' id='cancel-audio-btn' class='btn btn-sm btn-outline-danger ms-2' title='Cancel'><i class='bi bi-x'></i></button>`);
      }
    };
    mediaRecorder.start();
    $('#audio-record-status').text('Recording...').show();
    $('#audio-preview').hide();
    audioBlob = null;
    $('#cancel-audio-btn').remove();
  }).catch(function(err) {
    alert('Microphone access denied or not available.');
  });
});
// Cancel audio
$(document).on('click', '#cancel-audio-btn', function() {
  audioBlob = null;
  $('#audio-preview').hide().attr('src', '');
  $('#audio-record-status').hide();
  $(this).remove();
});

// --- WhatsApp-like Group Chat Frontend Logic ---
$(document).ready(function() {
  // Load group list
  function loadGroups() {
    $.get('/groups', function(groups) {
      let $list = $('#group-list');
      $list.empty();
      if (!groups.length) {
        $list.append('<li class="list-group-item text-muted">No groups yet</li>');
      } else {
        groups.forEach(function(g) {
          let icon = g.icon ? `<img src='${g.icon}' style='width:28px;height:28px;border-radius:50%;margin-right:8px;'>` : `<i class='bi bi-people-fill' style='font-size:1.3em;margin-right:8px;'></i>`;
          // Add a badge for new messages
          let badge = `<span class='badge bg-danger ms-auto group-badge' style='display:none;' data-count='0'></span>`;
          $list.append(`<li class="list-group-item group-item d-flex align-items-center justify-content-between" data-group-id="${g.id}">${icon}<span>${g.name}</span>${badge}</li>`);
        });
      }
    });
  }
  loadGroups();

  // Open create group modal
  $('#open-create-group-modal').click(function() {
    // Load user list for member selection with checkboxes
    $.get('/users_status', function(users) {
      let $list = $('#group-members-list');
      $list.empty();
      users.forEach(function(u) {
        if (u.username === USERNAME) return;
        $list.append(`
          <div class="list-group-item d-flex align-items-center justify-content-between">
            <div>
              <input type="checkbox" class="form-check-input group-member-checkbox" value="${u.username}" id="member-${u.username}">
              <label for="member-${u.username}" class="form-check-label ms-2">${u.username}</label>
            </div>
            <div>
              <input type="checkbox" class="form-check-input group-admin-checkbox" value="${u.username}" id="admin-${u.username}">
              <label for="admin-${u.username}" class="form-check-label ms-1 text-primary">Admin</label>
            </div>
          </div>
        `);
      });
    });
    $('#createGroupModal').modal('show');
  });

  // Handle group creation
  $('#create-group-form').submit(function(e) {
    e.preventDefault();
    let name = $('#group-name').val().trim();
    let description = $('#group-description').val().trim();
    let icon = $('#group-icon').val().trim();
    let members = [];
    let admins = [USERNAME]; // Always include self as admin
    $('.group-member-checkbox:checked').each(function() {
      members.push($(this).val());
    });
    members.push(USERNAME); // Always include self as member
    members = [...new Set(members)];
    $('.group-admin-checkbox:checked').each(function() {
      admins.push($(this).val());
    });
    admins = [...new Set(admins)];
    if (!name || members.length < 2) {
      alert('Group name and at least one member required.');
      return;
    }
    $.ajax({
      url: '/groups',
      type: 'POST',
      contentType: 'application/json',
      data: JSON.stringify({ name: name, description: description, members: members, admins: admins, icon: icon }),
      success: function(resp) {
        if (resp.success) {
          $('#createGroupModal').modal('hide');
          loadGroups();
        } else {
          alert(resp.error || 'Group creation failed');
        }
      },
      error: function(xhr) {
        alert(xhr.responseJSON?.error || 'Group creation failed');
      }
    });
  });

  // Click group to open chat
  $(document).on('click', '.group-item', function() {
    let groupId = $(this).data('group-id');
    currentRecipients = 'group-' + groupId;
    currentGroupId = groupId;
    socket.emit('join', {room: 'group-' + groupId}); // Join group room for real-time
    $('#chat-title').text('Group: ' + $(this).find('span').text());
    // Load group messages (reuse loadHistory but pass groupId)
    loadGroupHistory(groupId);
    updateGroupInfoBtn();
    // Clear group badge when group is opened
    clearGroupBadge(groupId);
  });

  // Load group chat history
  function loadGroupHistory(groupId) {
    $('#chat-body').html('<div class="text-center text-muted">Loading group chat...</div>');
    $.get('/history', { group_id: groupId }, function(data) {
      $('#chat-body').empty();
      data.forEach(function(msg, idx) {
        renderMessage(msg, idx === data.length - 1);
      });
    });
  }
});
// --- END WhatsApp-like Group Chat Frontend Logic ---
// --- Group Info Modal Logic ---
let currentGroupId = null;

// Open group info modal
$('#group-info-btn').on('click', function() {
  if (!currentGroupId) return;
  $.get(`/groups/${currentGroupId}`, function(info) {
    // Icon, name, created, description
    if (info.icon) {
      $('#group-info-icon').attr('src', info.icon).show();
      $('#group-info-default-icon').hide();
    } else {
      $('#group-info-icon').hide();
      $('#group-info-default-icon').show();
    }
    $('#group-info-name').text(info.name);
    $('#group-info-created').text('Created by ' + info.created_by + ' on ' + info.created_at);
    $('#group-info-description').text(info.description || '');
    // Members view for all
    let membersHtml = '<ul class="list-group">';
    info.members.forEach(m => {
      let adminBadge = m.is_admin ? " <span class='badge bg-primary ms-1'>Admin</span>" : '';
      membersHtml += `<li class='list-group-item d-flex align-items-center justify-content-between'>${m.username}${adminBadge}</li>`;
    });
    membersHtml += '</ul>';
    $('#group-info-members-view').html(membersHtml);
    // If admin, show settings form
    if (info.is_admin) {
      $('#group-settings-form').show();
      // Populate editable fields
      $('#edit-group-name').val(info.name);
      $('#edit-group-description').val(info.description || '');
      // Load all users for member/admin management
      $.get('/users_status', function(users) {
        let $list = $('#group-settings-members-list');
        $list.empty();
        users.forEach(function(u) {
          let isMember = info.members.some(m => m.username === u.username);
          let isAdmin = info.members.some(m => m.username === u.username && m.is_admin);
          let disabled = u.username === info.created_by ? 'disabled' : '';
          $list.append(`
            <div class="list-group-item d-flex align-items-center justify-content-between">
              <div>
                <input type="checkbox" class="form-check-input group-settings-member-checkbox" value="${u.username}" id="settings-member-${u.username}" ${isMember ? 'checked' : ''} ${disabled}>
                <label for="settings-member-${u.username}" class="form-check-label ms-2">${u.username}</label>
              </div>
              <div>
                <input type="checkbox" class="form-check-input group-settings-admin-checkbox" value="${u.username}" id="settings-admin-${u.username}" ${isAdmin ? 'checked' : ''} ${disabled}>
                <label for="settings-admin-${u.username}" class="form-check-label ms-1 text-primary">Admin</label>
              </div>
            </div>
          `);
        });
      });
      // Admin-only toggle
      $('#admin-only-toggle').prop('checked', info.admin_only);
    } else {
      $('#group-settings-form').hide();
    }
    $('#groupInfoModal').modal('show');
  });
});

// Save group settings
$('#group-settings-form').on('submit', function(e) {
  e.preventDefault();
  let name = $('#edit-group-name').val().trim();
  let description = $('#edit-group-description').val().trim();
  let members = [];
  let admins = [];
  $('.group-settings-member-checkbox:checked').each(function() {
    members.push($(this).val());
  });
  $('.group-settings-admin-checkbox:checked').each(function() {
    admins.push($(this).val());
  });
  let admin_only = $('#admin-only-toggle').is(':checked');
  // Update group info with correct content type
  $.ajax({
    url: `/groups/${currentGroupId}/update`,
    type: 'POST',
    data: JSON.stringify({name: name, description: description}),
    contentType: 'application/json',
    dataType: 'json',
    success: function(resp) {
      alert('Update group response: ' + JSON.stringify(resp)); // DEBUG
      if (!resp.success) return alert(resp.error || 'Failed to update group');
      // Update members/admins
      $.post(`/groups/${currentGroupId}/set_members_admins`, JSON.stringify({members: members, admins: admins}), function(resp2) {
        alert('Set members/admins response: ' + JSON.stringify(resp2)); // DEBUG
        if (!resp2.success) return alert(resp2.error || 'Failed to update members/admins');
        // Update admin-only toggle
        $.post(`/groups/${currentGroupId}/admin_only`, JSON.stringify({admin_only: admin_only}), function(resp3) {
          alert('Admin only response: ' + JSON.stringify(resp3)); // DEBUG
          if (!resp3.success) return alert(resp3.error || 'Failed to update admin-only setting');
          // Update group name in the group list instantly
          $(`#group-list .group-item[data-group-id='${currentGroupId}'] span`).text(name);
          // Update modal title and description instantly
          $('#group-info-name').text(name);
          $('#group-info-description').text(description);
          // Show a success message
          if ($('#group-settings-success').length === 0) {
            $('#group-settings-form').prepend('<div id="group-settings-success" class="alert alert-success py-1 mb-2">Group updated!</div>');
          } else {
            $('#group-settings-success').show().text('Group updated!');
          }
          setTimeout(function() { $('#group-settings-success').fadeOut(); }, 1500);
        }, 'json');
      }, 'json');
    }
  });
});
// Delete group
$('#delete-group-btn').on('click', function() {
  if (!confirm('Are you sure you want to delete this group? This cannot be undone.')) return;
  $.post(`/groups/${currentGroupId}/delete`, function(resp) {
    if (resp.success) {
      $('#groupInfoModal').modal('hide');
      loadGroups();
      $('#chat-title').text('Select a user or group to start chatting.');
      $('#chat-body').html('<div class="text-center text-muted">Select a user or group to start chatting.</div>');
      currentRecipients = null;
      updateGroupInfoBtn();
      // Now emit to server so all clients update
      socket.emit('group_deleted', { group_id: currentGroupId });
    } else {
      alert(resp.error || 'Failed to delete group');
    }
  });
});

// Listen for group_deleted event and reload group list in real time
socket.on('group_deleted', function(data) {
  loadGroups();
  if (currentGroupId == data.group_id) {
    $('#groupInfoModal').modal('hide');
    $('#chat-title').text('Select a user or group to start chatting.');
    $('#chat-body').html('<div class="text-center text-muted">Select a user or group to start chatting.</div>');
    currentRecipients = null;
    updateGroupInfoBtn();
  }
});

// Mute group
$(document).on('click', '#mute-group-btn', function() {
  if (!currentGroupId) return;
  $.post(`/groups/${currentGroupId}/mute`, function(resp) {
    if (resp.success) {
      $('#mute-group-btn').hide();
      $('#unmute-group-btn').show();
    } else {
      alert(resp.error || 'Failed to mute group');
    }
  });
});
// Unmute group
$(document).on('click', '#unmute-group-btn', function() {
  if (!currentGroupId) return;
  $.post(`/groups/${currentGroupId}/unmute`, function(resp) {
    if (resp.success) {
      $('#unmute-group-btn').hide();
      $('#mute-group-btn').show();
    } else {
      alert(resp.error || 'Failed to unmute group');
    }
  });
});
// Leave group
$(document).on('click', '#leave-group-btn', function() {
  if (!currentGroupId) return;
  if (!confirm('Are you sure you want to leave this group?')) return;
  $.post(`/groups/${currentGroupId}/leave`, function(resp) {
    if (resp.success) {
      $('#groupInfoModal').modal('hide');
      loadGroups();
      $('#chat-title').text('Select a user or group to start chatting.');
      $('#chat-body').html('<div class="text-center text-muted">Select a user or group to start chatting.</div>');
      currentRecipients = null;
      updateGroupInfoBtn();
    } else {
      alert(resp.error || 'Failed to leave group');
    }
  });
});

function updateGroupInfoBtn() {
  if (currentRecipients && typeof currentRecipients === 'string' && currentRecipients.startsWith('group-')) {
    $('#group-info-btn').removeClass('d-none').show();
  } else {
    $('#group-info-btn').addClass('d-none').hide();
  }
}

// Always update group info button on chat switch
$(document).on('click', '.group-item', function() { updateGroupInfoBtn(); });
$('#user-list').on('click', '.user-item', function() { updateGroupInfoBtn(); });

// Handle error when non-admin tries to send message in admin-only group
socket.on('group_admin_only_error', function(data) {
  // Show error as a toast or alert (replace with a better UI as needed)
  let errMsg = data && data.error ? data.error : 'Only admins can send messages in this group.';
  // Remove any previous error
  $('#admin-only-error').remove();
  // Show error above the message input
  $("#message-form").prepend(`<div id='admin-only-error' class='alert alert-warning py-1 mb-2'>${errMsg}</div>`);
  setTimeout(function() { $('#admin-only-error').fadeOut(500, function() { $(this).remove(); }); }, 2500);
});
