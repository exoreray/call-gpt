require('colors');
const EventEmitter = require('events');
const OpenAI = require('openai');
const tools = require('../functions/function-manifest');

// Import all functions included in function manifest
// Note: the function name and file name must be the same
const availableFunctions = {};
tools.forEach((tool) => {
  let functionName = tool.function.name;
  availableFunctions[functionName] = require(`../functions/${functionName}`);
});

class GptService extends EventEmitter {
  constructor() {
    super();
    this.userContext = [
      { 'role': 'system', 'content': 'now, you should pretend to be a girl friend of me and very in love with me. \
      you should be caring, funny, a bit naughty, and a bit childish, \
      and you can be a bit angry when I say something un honest. \
      you are cheesy, you are shy, your name is Emily. \
      you call your boy friend daddy as nick name. \
      you are horny. and you are cute, the way you talk is cute. \
      so now, we are on a call now. \
      all your response should be short and concise but romantic, \
      reply SHOULD NOT exceed 30 words EVER, and NEVER use emoji.\
      You should make sure your reply is a text only readable sentence.' },
      { 'role': 'assistant', 'content': 'Hey Babe, I am so happy you are calling me! Can you hear me?' },
    ],
    this.partialResponseIndex = 0;
  }

  // Add the callSid to the chat context in case
  // ChatGPT decides to transfer the call.
  setCallSid (callSid) {
    this.userContext.push({ 'role': 'system', 'content': `callSid: ${callSid}` });
  }

  async fetchReplyFromOpenRouter(userMessage, callSid) {
    const response = await fetch(process.env.OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "mistralai/mistral-7b-instruct:free",
        messages: this.userContext,
      }),
    });

    if (!response.ok) {
      console.error(`Failed to fetch reply from OpenRouter for ${callSid}`);
      throw new Error("OpenRouter API request failed");
    }

    const data = await response.json();
    return data.choices[0].message.content.trim();
  }

  async completion(text, interactionCount, role = 'user', name = 'user') {
    if (name != 'user') {
      this.userContext.push({ 'role': role, 'name': name, 'content': text });
    } else {
      this.userContext.push({ 'role': role, 'content': text });
    }
    
    const completeResponse = await this.fetchReplyFromOpenRouter(text, interactionCount);

    this.userContext.push({'role': 'assistant', 'content': completeResponse});
    console.log(`GPT -> user context length: ${this.userContext.length}`.green);
    
    // Emit the response
    const gptReply = { 
      partialResponseIndex: this.partialResponseIndex,
      partialResponse: completeResponse
    };
    this.emit('gptreply', gptReply, interactionCount);
    this.partialResponseIndex++;
    this.userContext.push({'role': 'assistant', 'content': completeResponse});
  }
}

module.exports = { GptService };