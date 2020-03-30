// Version: a_h_ (accelerometer, socket/fetch, Heroku, view/save)

const fs = require('fs')                        // File System module
const http = require('http')                    // http server module
const ws = require('ws')                        // WebSocket module

//*****************************************************************************
//********************************************** Receive request via http *****
//*****************************************************************************

const httpPort = process.env.PORT || 5000
let fileStream = fs.createWriteStream('data.csv')

const requestHandler = (request, response) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Max-Age': 2592000, // 30 days
    'Content-Type': 'text/html'
  }
  //console.log(`server.js requestHandler(): received ${request.method}`)

  if (request.method == 'POST') {    // assume body is fetch() sensor data from companion
    //console.log(`server.js requestHandler(): received POST from URL=${request.url}`)
    var body = ''

    request.on('data', function(data) {
      body += data
      //console.log(`requestHandler(): partial body: ${body}`)
    })

    request.on('end', function() {
      //console.log('requestHandler(): body: ' + body)

      // The companion doesn't really need a response, but it can help with debugging:
      response.writeHead(200, headers)
      response.end('post received')

      // Process the sensor data (same as if we'd received it via WebSocket):
      sendToClients(body)
      appendToFile(body)
    })
  } else if (request.method == 'GET') {  // respond by sending data.csv
    fileStream.end()  // close the file so no more batches can be written to it

    response.writeHead(200, {'Content-Type': 'text/csv'})
    let savedData = fs.readFileSync('data.csv')
    response.end(savedData)

    fileStream = fs.createWriteStream('data.csv')   // reopen file for subsequent batches
  }
}

const httpServer = http.createServer(requestHandler)

httpServer.listen(httpPort, (err) => {
  if (err) {
    return console.log('HTTP server listen failure: ', err)
  }

  console.log(`HTTP server is listening on port ${httpPort}`)
})//******************************************************************************
//*************************** Receive message from companion via WebSocket *****
//******************************************************************************

const wsServer = new ws.Server({server:server})  // WebSocket server

wsServer.on('connection', function connection(socket, request) {
  console.log(`server.js: connection from ${request.connection.remoteAddress}`)
  socket.on('message', function incoming(data) {
    //console.log(`server.js: received a message`)
    sendToClients(data, socket)
    appendToFile(data)
  })
})

function appendToFile(data) {
  // Unpack data string and save as CSV (for easy importing into a spreadsheet or database).
  // data can contain any number of values, so this function will work for different types of sensors.

  if (!fileStream.writable) {
    // Could possibly happen while file is being downloaded in response to GET request.
    console.log(`server.js appendToFile(): file isn't writable - dropping data batch`)
    return
  }

  let dataArray = JSON.parse(data)   // array of objects
  let readingArray, csvString
  dataArray.forEach(readingObject => {
    readingArray = Object.values(readingObject)
    csvString = String(readingArray[0])                // put the first data value into the CSV record (line)
    for (let i = 1; i < readingArray.length; i++) {    // append remaining values, with commas before each
      csvString += ',' + readingArray[i]
    }
    fileStream.write(`${csvString}\n`)   // should check for success
  })
}

//******************************************************************************
//*********************************** Send message to client via WebSocket *****
//******************************************************************************

function sendToClients(data, incomingSocket) {
  // Send data to all connected and open wsServer clients, except for incomingSocket.
  // data: text string to send.
  // incomingSocket: socket from companion on which data was received; undefined if using fetch().

  wsServer.clients.forEach(function each(client) {
    if (client !== incomingSocket && client.readyState === ws.OPEN) {
      //console.log(`server.js: sending to a client at ${client.url}; data=${data}`)
      client.send(data)
    }
  })
}