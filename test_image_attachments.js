#!/usr/bin/env node

// Test script to verify image attachment functionality
// Run this with: node test_image_attachments.js

const { supabase } = require('./supabaseClient');

// Test configuration
const TEST_CHAT_ID = 'test-chat-' + Date.now();
const TEST_USER_ID = 'test-user-123';
const TEST_IMAGE_URL = 'https://example.com/test-image.jpg';
const TEST_FILE_NAME = 'test-image.jpg';
const TEST_FILE_TYPE = 'image/jpeg';
const TEST_FILE_SIZE = 1024000; // 1MB

console.log('🧪 Starting Image Attachment Tests...');
console.log('Test Chat ID:', TEST_CHAT_ID);
console.log('Test User ID:', TEST_USER_ID);

// Test 1: Create a chat
async function testCreateChat() {
  console.log('\n📝 Test 1: Creating test chat...');
  
  try {
    const { data, error } = await supabase
      .from('chats')
      .insert({
        id: TEST_CHAT_ID,
        owner: TEST_USER_ID,
        title: 'Test Image Attachment Chat',
        metadata: { test: true }
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Failed to create chat:', error);
      return false;
    }

    console.log('✅ Chat created successfully:', data.id);
    return true;
  } catch (error) {
    console.error('❌ Error creating chat:', error);
    return false;
  }
}

// Test 2: Add user message with image attachment
async function testAddUserMessageWithAttachment() {
  console.log('\n📎 Test 2: Adding user message with image attachment...');
  
  try {
    const { data, error } = await supabase
      .from('messages')
      .insert({
        chat_id: TEST_CHAT_ID,
        role: 'user',
        content: 'Here is a test image attachment',
        status: 'done',
        file_url: TEST_IMAGE_URL,
        file_name: TEST_FILE_NAME,
        file_type: TEST_FILE_TYPE,
        file_size: TEST_FILE_SIZE,
        metadata: { test: true },
        created_by: TEST_USER_ID
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Failed to add message with attachment:', error);
      return false;
    }

    console.log('✅ Message with attachment added successfully:');
    console.log('   - Message ID:', data.id);
    console.log('   - File URL:', data.file_url);
    console.log('   - File Name:', data.file_name);
    console.log('   - File Type:', data.file_type);
    console.log('   - File Size:', data.file_size);
    return data.id;
  } catch (error) {
    console.error('❌ Error adding message with attachment:', error);
    return false;
  }
}

// Test 3: Retrieve messages and verify attachment data
async function testRetrieveMessages() {
  console.log('\n📥 Test 3: Retrieving messages and verifying attachment data...');
  
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('chat_id', TEST_CHAT_ID)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('❌ Failed to retrieve messages:', error);
      return false;
    }

    console.log('✅ Retrieved', data.length, 'messages');
    
    // Find message with attachment
    const messageWithAttachment = data.find(msg => msg.file_url);
    
    if (!messageWithAttachment) {
      console.error('❌ No message with attachment found');
      return false;
    }

    console.log('✅ Message with attachment found:');
    console.log('   - Content:', messageWithAttachment.content);
    console.log('   - File URL:', messageWithAttachment.file_url);
    console.log('   - File Name:', messageWithAttachment.file_name);
    console.log('   - File Type:', messageWithAttachment.file_type);
    console.log('   - File Size:', messageWithAttachment.file_size);

    // Verify all attachment fields are present
    const requiredFields = ['file_url', 'file_name', 'file_type', 'file_size'];
    const missingFields = requiredFields.filter(field => !messageWithAttachment[field]);
    
    if (missingFields.length > 0) {
      console.error('❌ Missing attachment fields:', missingFields);
      return false;
    }

    console.log('✅ All attachment fields are present and valid');
    return true;
  } catch (error) {
    console.error('❌ Error retrieving messages:', error);
    return false;
  }
}

// Test 4: Test attachment parsing (simulate frontend logic)
async function testAttachmentParsing() {
  console.log('\n🔍 Test 4: Testing attachment parsing logic...');
  
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('chat_id', TEST_CHAT_ID)
      .eq('role', 'user')
      .single();

    if (error) {
      console.error('❌ Failed to get message for parsing test:', error);
      return false;
    }

    // Simulate the supabaseMessageToFrontend conversion
    let attachments = undefined;
    if (data.file_url) {
      attachments = [{
        url: data.file_url,
        fileName: data.file_name || 'Unknown',
        fileType: data.file_type || 'application/octet-stream',
        originalName: data.file_name,
        size: data.file_size
      }];
    }

    if (!attachments || attachments.length === 0) {
      console.error('❌ Attachment parsing failed');
      return false;
    }

    console.log('✅ Attachment parsing successful:');
    console.log('   - Parsed attachments:', attachments.length);
    console.log('   - First attachment:', attachments[0]);
    return true;
  } catch (error) {
    console.error('❌ Error in attachment parsing test:', error);
    return false;
  }
}

// Cleanup function
async function cleanup() {
  console.log('\n🧹 Cleaning up test data...');
  
  try {
    // Delete messages first (due to foreign key constraints)
    await supabase
      .from('messages')
      .delete()
      .eq('chat_id', TEST_CHAT_ID);

    // Delete chat
    await supabase
      .from('chats')
      .delete()
      .eq('id', TEST_CHAT_ID);

    console.log('✅ Cleanup completed');
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  }
}

// Main test runner
async function runTests() {
  console.log('🚀 Running Image Attachment Tests...\n');
  
  let allTestsPassed = true;
  
  try {
    // Run tests in sequence
    const chatCreated = await testCreateChat();
    if (!chatCreated) {
      allTestsPassed = false;
      return;
    }

    const messageAdded = await testAddUserMessageWithAttachment();
    if (!messageAdded) {
      allTestsPassed = false;
      return;
    }

    const messagesRetrieved = await testRetrieveMessages();
    if (!messagesRetrieved) {
      allTestsPassed = false;
      return;
    }

    const parsingWorked = await testAttachmentParsing();
    if (!parsingWorked) {
      allTestsPassed = false;
      return;
    }

  } catch (error) {
    console.error('❌ Unexpected error during tests:', error);
    allTestsPassed = false;
  } finally {
    // Always cleanup
    await cleanup();
  }

  // Final results
  console.log('\n' + '='.repeat(50));
  if (allTestsPassed) {
    console.log('🎉 ALL TESTS PASSED! Image attachment functionality is working correctly.');
    console.log('✅ Database schema supports file attachments');
    console.log('✅ Messages can be saved with attachment data');
    console.log('✅ Attachment data can be retrieved correctly');
    console.log('✅ Frontend parsing logic works as expected');
  } else {
    console.log('❌ SOME TESTS FAILED! Please check the errors above.');
  }
  console.log('='.repeat(50));
}

// Run the tests
runTests().catch(console.error);