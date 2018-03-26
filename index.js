var builder = require('botbuilder');
var restify = require('restify');
var documentClient = require("documentdb").DocumentClient;
// ========================== Section 1: Default Bot  ==========================

// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
   console.log('%s listening to %s', server.name, server.url); 
});

// Create chat connector for communicating with the Bot Framework Service
var connector = new builder.ChatConnector({
    appId: process.env.MicrosoftAppId,
    appPassword: process.env.MicrosoftAppPassword
});

// Listen for messages from users 
server.post('/api/messages', connector.listen());

// Receive messages from the user and respond by echoing each message back (prefixed with 'You said:')
// var bot = new builder.UniversalBot(connector, function (session) {
//     session.send("You said: %s", session.message.text);
// });

// ========================== Section 2: Use CosmosDB as State  ==========================
var azure = require('botbuilder-azure'); 
var documentDbOptions = {
    host: 'Your-Azure-DocumentDB-URI', //'Your-Azure-DocumentDB-URI'
    masterKey: 'Your-Azure-DocumentDB-Key', //'Your-Azure-DocumentDB-Key'
    database: 'botdocs',   
    collection: 'botdata'
};

var docDbClient = new azure.DocumentDbClient(documentDbOptions);
var cosmosStorage = new azure.AzureBotStorage({ gzipData: false }, docDbClient);

// var bot = new builder.UniversalBot(connector, function (session) {
//     // ... Bot code ...
//     session.send("You said: %s", session.message.text);
// })
// .set('storage', cosmosStorage);

// ========================== Section 3: Set proactive message  ==========================
var client  = new documentClient('Your-Azure-DocumentDB-URI', { "masterKey": 'Your-Azure-DocumentDB-Key'});

var HttpStatusCodes = { NOTFOUND: 404 };
var databaseUrl = 'dbs/botdocs';
var collectionUrl =  databaseUrl + '/colls/botdata';


var bot = new builder.UniversalBot(connector, function (session) {
    // ... Bot code ...
    session.send("You said: %s. You are registed, will send you an messag in 5 seconds", session.message.text);
    session.userData.savedAddress = session.message.address;

    setTimeout(() => {
        sendProactiveMessage();
    }, 5000);
})
.set('storage', cosmosStorage);

// send simple notification
function sendProactiveMessage() {
    getDatabase()
    .then(() => getCollection())
    .then(() => queryCollection())
    .then(function(userAddressList) {
        console.log(userAddressList);
        for (var user of userAddressList) {
            console.log(`\tSend message to user ${user}`);
            var msg = new builder.Message().address(user.data.savedAddress);
            msg.text('Hello, this is a proactive notification');
            msg.textLocale('en-US');
            bot.send(msg);
        }
    })


}

// Query Functions
/**
 * Get the database by ID, or create if it doesn't exist.
 * @param {string} database - The database to get or create
 */
function getDatabase() {
    return new Promise((resolve, reject) => {
        client.readDatabase(databaseUrl, (err, result) => {
            if (err) {
                if (err.code == HttpStatusCodes.NOTFOUND) {
                    client.createDatabase(config.database, (err, created) => {
                        if (err) reject(err)
                        else resolve(created);
                    });
                } else {
                    reject(err);
                }
            } else {
                console.log(result);
                resolve(result);
            }
        });
    });
}

/**
 * Get the collection by ID, or create if it doesn't exist.
 */
function getCollection() {
    return new Promise((resolve, reject) => {
        client.readCollection(collectionUrl, (err, result) => {
            if (err) {
                if (err.code == HttpStatusCodes.NOTFOUND) {
                    client.createCollection(databaseUrl, config.collection, { offerThroughput: 400 }, (err, created) => {
                        if (err) reject(err)
                        else resolve(created);
                    });
                } else {
                    reject(err);
                }
            } else {
                console.log(result);
                resolve(result);
            }
        });
    });
}


/**
 * Query the collection using SQL
 */
function queryCollection() {
    return new Promise((resolve, reject) => {
        client.queryDocuments(
            collectionUrl,
            'SELECT * FROM root r where r.data.savedAddress != null'
        ).toArray((err, results) => {
            if (err) reject(err)
            else {
                for (var queryResult of results) {
                    let resultString = JSON.stringify(queryResult);
                    console.log(`\tQuery returned ${resultString}`);
                }
                resolve(results);
            }
        });
    });
};
