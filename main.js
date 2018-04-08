const noble = require('noble');
const request = require('request');

function sendMessage(message) {
  console.log(`Send: ${message}`);
  // return;
  const options = {
    url: process.env.SLACK_WEBHOOK_URL,
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    json: {
      text: message,
      icon_emoji: ':wc:',
      username: 'トイレセンサー',
    }
  };
  request.post(options, (error, response, body) => {
    if (error) {
      console.log(error);
      return;
    }
  });
}

noble.on('stateChange', (state) => {
  if (state === 'poweredOn') {
    // ペリフェラルのスキャンを開始
    noble.startScanning();
  } else {
    noble.stopScanning();
  }
});

let previousSignal, timer, existence;

noble.on('discover', (peripheral) => {
  if (peripheral.advertisement.localName === 'BLESerial_F') {
    console.log('Peripheral found');
    noble.stopScanning();
    peripheral.connect((error) => {
      if (error) {
        console.log(error);
        return;
      }

      peripheral.once('disconnect', () => {
        console.log('Disconnected');
        sendMessage('接続が切れました')
        clearTimeout(timer);
        previousSignal = undefined;
        noble.startScanning();
      });

      peripheral.discoverServices(['feed0001c4974476a7ed727de7648ab1'], (error, services) => {
        if (error) {
          console.log(error);
          return;
        }

        console.log('Service found');

        services[0].discoverCharacteristics(['feedaa03c4974476a7ed727de7648ab1'], (error, characteristics) => {
          if (error) {
            console.log(error);
            return;
          }

          console.log('Characteristics found');

          sendMessage('起動しました')

          characteristics[0].on('data', (data, isNotification) => {
            const signal = data.readInt8(0);
            console.log(signal);
            if (previousSignal === undefined || signal !== previousSignal) {
              console.log(`${previousSignal} -> ${signal}`);
              if (previousSignal === undefined) {
                if (signal === 0) {
                  existence = false;
                  sendMessage('誰もいません');
                } else {
                  existence = true;
                  sendMessage('誰かいます');
                }
              } else if (signal === 0) {
                timer = setTimeout(() => {
                  console.log('No one here');
                  sendMessage('誰もいなくなりました');
                  existence = false;
                }, 60 * 1000);
              } else {
                if (!existence) {
                  console.log('Someone here');
                  sendMessage('誰か入ってきました');
                  existence = true;
                }
                clearTimeout(timer);
              }
              previousSignal = signal;
            }
          });

          characteristics[0].notify(true, (error) => {
            if (error) {
              console.log(error);
              return;
            }
            console.log('Notification enabled');
          });

        });
      });
    });
  }
});
