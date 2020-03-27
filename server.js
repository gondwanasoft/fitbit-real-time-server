// Version: hsds (heart-rate, socket, DoryNode, save)

const fs = require('fs')                        // File System module
const http = require('http')                    // http server module
const ws = require('ws')                        // WebSocket module

//******************************************************************************
//*************************** Receive message from companion via WebSocket *****
//******************************************************************************

const wsServer = new ws.Server({ port: 8080 })  // WebSocket server
const fileStream = fs.createWriteStream('data.csv')

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

  let dataObject = JSON.parse(data)
  let dataArray = Object.values(dataObject)
  //console.log(`appendToFile(): ${data}; ${dataArray}`)
  let csvString = String(dataArray[0])            // put the first data value into the CSV record (line)
  for (let i = 1; i < dataArray.length; i++) {    // append remaining values, with commas before each
    csvString += ',' + dataArray[i]
  }
  fileStream.write(`${csvString}\n`)
}

//******************************************************************************
//*********************************** Send message to client via WebSocket *****
//******************************************************************************

function sendToClients(data, incomingSocket) {
  // Send data to all connected and open wsServer clients, except for incomingSocket.
  // data: text string to send.
  // incomingSocket: socket from companion on which data was received.

  wsServer.clients.forEach(function each(client) {
    if (client !== incomingSocket && client.readyState === ws.OPEN) {
      //console.log(`server.js: sending to a client; data=${data}`) // it would be nice to include client.url, but this is often undefined
      client.send(data)
    }
  })
}

//*****************************************************************************
//********************************************** Receive request via http *****
//*****************************************************************************

const httpPort = 3000

const requestHandler = (request, response) => {
  // If a GET request is received, respond by sending data.csv
  //console.log(`server.js requestHandler(): received ${request.method}`)
  if (request.method == 'GET') {
    response.writeHead(200, {'Content-Type': 'text/csv'})
    let savedData = fs.readFileSync('data.csv')
    response.end(savedData)
  }
}

const httpServer = http.createServer(requestHandler)

httpServer.listen(httpPort, (err) => {
  if (err) {
    return console.log('HTTP server listen failure: ', err)
  }

  console.log(`HTTP server is listening on port ${httpPort}`)
})