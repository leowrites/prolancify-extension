let PAID_USER = false;
let image;

//Appends image
setTimeout(function () {
  let textarea = document.querySelector('.up-textarea');
  image = document.createElement('img');
  image.src = chrome.runtime.getURL('image.png');
  image.width = 20;
  image.height = 20;
  let div = document.createElement('div');
  div.style.position = 'absolute';
  div.style.top = '55px';
  div.style.right = '35px';
  div.appendChild(image);
  // add stylesheet for spinning icon
  const link = document.createElement('link');
  link.href = chrome.runtime.getURL('../index.css');
  link.type = 'text/css';
  link.rel = 'stylesheet';
  document.getElementsByTagName('head')[0].appendChild(link);

  textarea.parentNode.insertBefore(div, textarea.nextSibling);

  image.addEventListener('click', function (event) {
    answer(event.currentTarget);
  });
}, 4000);

//retreives job description
function answer(element) {
  if (PAID_USER) {
    let prompt =
      'Write me a cover letter for a job with the following description: ' + getJobDescription();
    let response = ' ';
    image.classList.add('prolancify-loader');

    openAi(prompt).then(function (data) {
      response = data;
      textArea = document.querySelector('.up-textarea');
      textArea.value = response;
      image.classList.remove('prolancify-loader');
    });
  } else {
    authenticate();
  }
}

function getJobDescription() {
  let job = '';

  const title = document.querySelector('h3.mb-20');
  let innerText = title.innerText;
  job += innerText;

  const description = document.querySelector('.up-truncation');
  const firstChild = description.firstElementChild;
  innerText = firstChild.innerText;
  job += ' ' + innerText;

  return job;
}

async function openAi(question) {
  // if user is authenticated
  if (PAID_USER) {
    console.log('sending message');
    try {
      const res = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'answer', question: question }, function (response) {
          resolve(response);
        });
      });
      return res.data;
    } catch (err) {
      console.error('ERROR something broke: ' + error);
    }
  }
}

function removeTwoLines(str) {
  return str.replace(/^.*\n.*\n/, '');
}

function removePeriod(json) {
  json.forEach(function (element, index) {
    if (element === '.') {
      json.splice(index, 1);
    }
  });
  return json;
}

function createResponse(json) {
  let response = '';
  let choices = removePeriod(json.choices);
  if (choices.length > 0) {
    response = json.choices[0].text;
  }

  return response;
}

function authenticate() {
  console.log('authenticating user');
  chrome.runtime.sendMessage({ type: 'authenticate' }, function (response) {
    console.log(response);
    if (response.PAID_USER == true) {
      console.log('Authenticated user');
      PAID_USER = response.PAID_USER;
      answer();
    } else {
      open('https://chat.openai.com/auth/login', '_blank');
    }
  });
}
