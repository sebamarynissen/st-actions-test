// # send-messages.js

import core from '@actions/core';
const messages = core.getInput('messages');

console.log(JSON.parse(messages));
