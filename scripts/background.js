const STRIPE =
  'sk_test_51MX80CIJutlhfp0KMN8UmWhyDSd19RR1HAGnfuWwyHqk6a6tViSsqBAvy21ngEKFw2cgEHsDhdR2knf9Swh0W5WF00dEz58AKv';
let ACCESS_TOKEN = '';

// listen for messages from content.js
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.type === 'authenticate') {
    authenticate(sendResponse);
    return true;
  } else if (request.type === 'answer') {
    answer(request, sendResponse);
    return true;
  }
});

function uuidv4() {
  return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c) =>
    (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)
  );
}

// get customer from stripe and check if they are a paid user
function getCusomters(email, sendResponse) {
  return new Promise((resolve, reject) => {
    fetch('https://api.stripe.com/v1/customers?expand[]=data.subscriptions', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${STRIPE}`,
      },
    })
      .then((res) => {
        return res.json();
      })
      .then((data) => {
        console.log(data);
        data.data.forEach((d) => {
          if (d.email === email && d.subscriptions.data[0]?.status === 'active') {
            resolve({ PAID_USER: true });
          }
          resolve({ PAID_USER: false });
        });
      });
  });
}

// get access token from openai, if there is no session then ask user to login
// then check if user is a paid user
function authenticate(sendResponse) {
  fetch('https://chat.openai.com/api/auth/session').then((res) => {
    if (res.status === 403) {
      sendResponse({ PAID_USER: false });
    }
    res.json().then((data) => {
      if (!data.accessToken) {
        throw new Error('No access token');
      }
      // continue to check with getCustomer
      getCusomters(data.user.email, sendResponse).then((res) => {
        if (res.PAID_USER) {
          sendResponse({ PAID_USER: true });
          ACCESS_TOKEN = data.accessToken;
          sendResponse({ PAID_USER: true });
        } else {
          sendResponse({ PAID_USER: false });
        }
      });
    });
  });
}

// send question to openai and get answer
// if success, read the event stream and send the answer back to content.js
// if error, send error message back to content.js
function answer(request, sendResponse) {
  fetch('https://chat.openai.com/backend-api/conversation', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      action: 'next',
      messages: [
        {
          id: uuidv4(),
          role: 'user',
          content: {
            content_type: 'text',
            parts: [request.question],
          },
        },
      ],
      model: 'text-davinci-002-render',
      parent_message_id: uuidv4(),
    }),
  })
    .then((response) => {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let result = '';
      function read() {
        reader.read().then(({ value, done }) => {
          if (done) {
            const arr = result.split('data: ');
            const obj = JSON.parse(arr[arr.length - 2]);
            const data = obj.message.content.parts[0];
            sendResponse({ data: data });
            return data;
          }
          result += decoder.decode(value);
          return read();
        });
      }
      return read();
    })
    .catch((err) => {
      console.error('HTTP ERROR: ' + response.status + '\n' + response.statusText);
    });
}
