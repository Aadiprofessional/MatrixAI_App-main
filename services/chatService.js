import { supabase } from '../supabaseClient';

// Interface for the new message structure
export const SupabaseMessage = {
  id: '',
  chat_id: '',
  role: 'user', // 'user' | 'assistant'
  content: '',
  status: 'done', // 'pending' | 'streaming' | 'done'
  position: 0,
  created_at: '',
  metadata: {},
  external_ref: '',
  file_url: '',
  file_name: '',
  file_type: '',
  file_size: 0,
};

// Interface for chat structure
export const SupabaseChat = {
  id: '',
  owner: '',
  title: '',
  created_at: '',
  position_counter: 0,
  metadata: {},
  role: 'assistant',
};

// Frontend message format for compatibility
export const FrontendMessage = {
  message_id: '',
  chat_id: '',
  sender_type: 'user', // 'user' | 'assistant' | 'system'
  role: '',
  content: '',
  timestamp: '',
  content_type: 'text', // 'text' | 'image' | 'code' | 'markdown' | 'json'
  fileContent: '',
  fileName: '',
  isStreaming: false,
  attachments: [],
  file_url: '',
  file_name: '',
  file_type: '',
  file_size: 0,
};

// Create a new chat using the new structure
export const createNewChat = async (userId, title = 'New Chat', metadata = {}, role = 'assistant') => {
  try {
    const { data, error } = await supabase
      .from('chats')
      .insert({
        owner: userId,
        title,
        metadata,
        role
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error creating chat:', error);
      return null;
    }

    return data.id;
  } catch (error) {
    console.error('Error in createNewChat:', error);
    return null;
  }
};

// Add a user message to a chat
export const addUserMessage = async (
  chatId,
  userId,
  content,
  metadata = {},
  externalRef = null
) => {
  try {
    const { data, error } = await supabase
      .from('messages')
      .insert({
        chat_id: chatId,
        role: 'user',
        content: content,
        status: 'done',
        metadata: metadata,
        external_ref: externalRef,
        created_by: userId
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding user message:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in addUserMessage:', error);
    return null;
  }
};

// Add user message with file attachment support
export const addUserMessageWithAttachment = async (
  chatId,
  userId,
  content,
  fileUrl = null,
  fileName = null,
  fileType = null,
  fileSize = null,
  metadata = {},
  externalRef = null
) => {
  try {
    const { data, error } = await supabase
      .from('messages')
      .insert({
        chat_id: chatId,
        role: 'user',
        content: content,
        status: 'done',
        file_url: fileUrl,
        file_name: fileName,
        file_type: fileType,
        file_size: fileSize,
        metadata: metadata,
        external_ref: externalRef,
        created_by: userId
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding user message with attachment:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in addUserMessageWithAttachment:', error);
    return null;
  }
};

// Start an assistant message
export const startAssistantMessage = async (
  chatId,
  userId,
  metadata = {},
  externalRef = null
) => {
  try {
    const { data, error } = await supabase
      .from('messages')
      .insert({
        chat_id: chatId,
        role: 'assistant',
        content: '',
        status: 'streaming',
        metadata: metadata,
        external_ref: externalRef,
        created_by: userId
      })
      .select()
      .single();

    if (error) {
      console.error('Error starting assistant message:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in startAssistantMessage:', error);
    return null;
  }
};

// Append a chunk to an assistant message
export const appendMessageChunk = async (messageId, chunk) => {
  try {
    // First, get the current message to append to its content
    const { data: currentMessage, error: fetchError } = await supabase
      .from('messages')
      .select('content')
      .eq('id', messageId)
      .single();

    if (fetchError) {
      console.error('Error fetching current message:', fetchError);
      return false;
    }

    const newContent = (currentMessage.content || '') + chunk;

    // Update the message with the new content
    const { error: updateError } = await supabase
      .from('messages')
      .update({ 
        content: newContent,
        updated_at: new Date().toISOString()
      })
      .eq('id', messageId);

    if (updateError) {
      console.error('Error appending message chunk:', updateError);
      return false;
    }

    // Also store the chunk in message_chunks table for tracking
    const { error: chunkError } = await supabase
      .from('message_chunks')
      .insert({
        message_id: messageId,
        sequence_number: Math.floor(Date.now() / 1000), // Use timestamp as sequence
        chunk_content: chunk
      });

    if (chunkError) {
      console.warn('Warning: Could not store chunk in message_chunks table:', chunkError);
      // Don't fail the operation if chunk storage fails
    }

    return true;
  } catch (error) {
    console.error('Error in appendMessageChunk:', error);
    return false;
  }
};

// Finalize a message
export const finalizeMessage = async (messageId) => {
  try {
    const { error } = await supabase
      .from('messages')
      .update({ 
        status: 'done',
        updated_at: new Date().toISOString()
      })
      .eq('id', messageId);

    if (error) {
      console.error('Error finalizing message:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in finalizeMessage:', error);
    return false;
  }
};

// Cancel a message (set status to cancelled)
export const cancelMessage = async (messageId) => {
  try {
    const { error } = await supabase
      .from('messages')
      .update({ 
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('id', messageId);

    if (error) {
      console.error('Error cancelling message:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in cancelMessage:', error);
    return false;
  }
};

// Get all messages for a chat using new structure
export const getNewChatMessages = async (chatId) => {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('position', { ascending: true });

    if (error) {
      console.error('Error fetching chat messages:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in getNewChatMessages:', error);
    return [];
  }
};

// Get chat messages with lazy loading support
export const getChatMessagesLazy = async (
  chatId,
  limit = 20,
  beforePosition = null
) => {
  try {
    console.log('getChatMessagesLazy called with:', { chatId, limit, beforePosition });
    
    let query = supabase
      .from('messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('position', { ascending: false })
      .limit(limit);

    // If beforePosition is provided, load messages before that position
    if (beforePosition !== null && beforePosition !== undefined) {
      query = query.lt('position', beforePosition);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching chat messages with lazy loading:', error);
      return [];
    }

    console.log('getChatMessagesLazy result:', { 
      chatId, 
      beforePosition,
      messageCount: data?.length || 0,
      messages: data?.map(msg => ({ id: msg.id, position: msg.position, content: msg.content?.substring(0, 30) + '...' })) || []
    });

    // Reverse to get chronological order (oldest first)
    return (data || []).reverse();
  } catch (error) {
    console.error('Error in getChatMessagesLazy:', error);
    return [];
  }
};

// Get the latest messages for initial load
export const getLatestChatMessages = async (chatId, limit = 20) => {
  try {
    console.log('getLatestChatMessages called with:', { chatId, limit });
    
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('position', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching latest chat messages:', error);
      return [];
    }

    console.log('getLatestChatMessages result:', { 
      chatId, 
      messageCount: data?.length || 0,
      messages: data?.map(msg => ({ id: msg.id, content: msg.content?.substring(0, 50) + '...' })) || []
    });

    // Reverse to get chronological order (oldest first)
    return (data || []).reverse();
  } catch (error) {
    console.error('Error in getLatestChatMessages:', error);
    return [];
  }
};

// Get all chats for a user using new structure
export const getNewUserChats = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('chats')
      .select('*')
      .eq('owner', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching user chats:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in getNewUserChats:', error);
    return [];
  }
};

// Delete a chat and all its messages using new structure
export const deleteNewChat = async (chatId, userId) => {
  try {
    // First delete all message chunks
    const { error: chunksError } = await supabase
      .from('message_chunks')
      .delete()
      .in('message_id', 
        supabase
          .from('messages')
          .select('id')
          .eq('chat_id', chatId)
      );

    if (chunksError) {
      console.warn('Warning: Error deleting message chunks:', chunksError);
      // Continue with deletion even if chunks fail
    }

    // Then delete all messages in the chat (this should cascade due to foreign key)
    const { error: messagesError } = await supabase
      .from('messages')
      .delete()
      .eq('chat_id', chatId);

    if (messagesError) {
      console.error('Error deleting chat messages:', messagesError);
      return false;
    }

    // Finally delete the chat itself
    const { error: chatError } = await supabase
      .from('chats')
      .delete()
      .eq('id', chatId)
      .eq('owner', userId);

    if (chatError) {
      console.error('Error deleting chat:', chatError);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in deleteNewChat:', error);
    return false;
  }
};

// Update chat title using new structure
export const updateNewChatTitle = async (chatId, userId, title) => {
  try {
    const { error } = await supabase
      .from('chats')
      .update({ title })
      .eq('id', chatId)
      .eq('owner', userId);

    if (error) {
      console.error('Error updating chat title:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in updateNewChatTitle:', error);
    return false;
  }
};

// Update chat role
export const updateChatRole = async (chatId, userId, role) => {
  try {
    const { error } = await supabase
      .from('chats')
      .update({ role })
      .eq('id', chatId)
      .eq('owner', userId);

    if (error) {
      console.error('Error updating chat role:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in updateChatRole:', error);
    return false;
  }
};

// Convert SupabaseMessage to FrontendMessage for compatibility
export const supabaseMessageToFrontend = (supabaseMessage) => {
  let content = supabaseMessage.content;
  let fileContent = undefined;
  let fileName = undefined;
  
  // Check for new ;;%%;; delimited URLs
  if (content && typeof content === 'string' && content.includes(';;%%;;')) {
    const urlMatch = content.match(/;;%%;;(.*?);;%%;;/);
    if (urlMatch) {
      fileContent = urlMatch[1].trim();
      content = content.replace(/;;%%;;.*?;;%%;;/g, '').trim();
      fileName = 'Attachment';
    }
  }
  
  // Create attachments array if file attachment data exists
  let attachments = undefined;
  if (supabaseMessage.file_url) {
    attachments = [{
      url: supabaseMessage.file_url,
      fileName: supabaseMessage.file_name || 'Unknown',
      fileType: supabaseMessage.file_type || 'application/octet-stream',
      originalName: supabaseMessage.file_name,
      size: supabaseMessage.file_size
    }];
  }
  
  return {
    message_id: supabaseMessage.id,
    chat_id: supabaseMessage.chat_id,
    sender_type: supabaseMessage.role,
    role: supabaseMessage.role,
    content: content,
    timestamp: supabaseMessage.created_at,
    content_type: 'text',
    isStreaming: supabaseMessage.status === 'streaming',
    fileContent: fileContent,
    fileName: fileName,
    attachments: attachments,
    file_url: supabaseMessage.file_url,
    file_name: supabaseMessage.file_name,
    file_type: supabaseMessage.file_type,
    file_size: supabaseMessage.file_size
  };
};

// Convert FrontendMessage to SupabaseMessage format
export const frontendMessageToSupabase = (frontendMessage, chatId) => {
  return {
    chat_id: chatId,
    role: frontendMessage.role === 'bot' ? 'assistant' : frontendMessage.role,
    content: frontendMessage.content,
    status: frontendMessage.isStreaming ? 'streaming' : 'done',
    metadata: {},
    file_url: frontendMessage.file_url,
    file_name: frontendMessage.file_name,
    file_type: frontendMessage.file_type,
    file_size: frontendMessage.file_size
  };
};

// Subscribe to real-time message updates for a chat
export const subscribeToMessages = (chatId, onMessageUpdate) => {
  const subscription = supabase
    .channel(`messages:${chatId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'messages',
        filter: `chat_id=eq.${chatId}`
      },
      (payload) => {
        console.log('Real-time message update:', payload);
        onMessageUpdate(payload);
      }
    )
    .subscribe();

  return subscription;
};

// Subscribe to real-time chat updates for a user
export const subscribeToChats = (userId, onChatUpdate) => {
  const subscription = supabase
    .channel(`chats:${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'chats',
        filter: `owner=eq.${userId}`
      },
      (payload) => {
        console.log('Real-time chat update:', payload);
        onChatUpdate(payload);
      }
    )
    .subscribe();

  return subscription;
};

// Unsubscribe from real-time updates
export const unsubscribeFromUpdates = (subscription) => {
  if (subscription) {
    supabase.removeChannel(subscription);
  }
};

// Get a specific chat by ID
export const getNewChat = async (chatId, userId) => {
  try {
    const { data, error } = await supabase
      .from('chats')
      .select('*')
      .eq('id', chatId)
      .eq('owner', userId)
      .single();

    if (error) {
      console.error('Error fetching chat:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in getNewChat:', error);
    return null;
  }
};

// Update message content (for editing)
export const updateMessageContent = async (messageId, content) => {
  try {
    const { error } = await supabase
      .from('messages')
      .update({ 
        content: content,
        updated_at: new Date().toISOString()
      })
      .eq('id', messageId);

    if (error) {
      console.error('Error updating message content:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in updateMessageContent:', error);
    return false;
  }
};

// Get message chunks for a specific message (for debugging/analysis)
export const getMessageChunks = async (messageId) => {
  try {
    const { data, error } = await supabase
      .from('message_chunks')
      .select('*')
      .eq('message_id', messageId)
      .order('sequence_number', { ascending: true });

    if (error) {
      console.error('Error fetching message chunks:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in getMessageChunks:', error);
    return [];
  }
};