const process = require('node:process');
const express = require('express')

const supabaseClient = require('../integrations/supabase');
const redisClient = require('../integrations/redis')
const { PORT } = require('../data');

function startServer() {
  const app = express();
  console.log(`Worker ${process.pid} started`);

  app.get('/api/process-data', async function (req, res) {
    let redisKeyValue;
    let { id: requestUniqueIdentifier } = req.query || {};
    requestUniqueIdentifier = Number(requestUniqueIdentifier)
    // let requestUniqueIdentifier = Math.floor(Math.random() * 10000000000);
    console.log(`NOW PROCESSING REQUEST WITH ID=${requestUniqueIdentifier}`);
    
    try {  
      const redisKeyId = `request-identifier-${requestUniqueIdentifier}`;
      redisKeyValue = await redisClient.get(redisKeyId);
      
      if (redisKeyValue) {
        console.log(`REQUEST_ID=${requestUniqueIdentifier} ALREADY EXISTS WITH STATUS AS ${redisKeyValue}`)

        let response = `!! REQUEST_ID=${requestUniqueIdentifier} IS IN PENDING !!`;
        if (redisKeyValue === 'completed') {
          response = `!! REQUEST_ID=${requestUniqueIdentifier} IS ALREADY COMPLETED !!`
        }

        return res.send(response);
      } else {
        await redisClient.set(redisKeyId, 'pending');
        await supabaseClient.from('orders').insert({ request_identifier: requestUniqueIdentifier, status: 'pending' });
        
        console.log(`!! REQUEST_ID=${requestUniqueIdentifier} IS NOW COMPLETED !! `)
        await supabaseClient.from('orders').update({ status: 'completed' }).eq('request_identifier', requestUniqueIdentifier)
        await redisClient.set(redisKeyId, 'completed');
        
        return res.send(`!! REQUEST_ID=${requestUniqueIdentifier} IS NOW COMPLETED !!`);
      }
    } catch (error) {
      console.log(`Error Caught: ${error}`)
      if (redisKeyValue && redisKeyValue !== 'failed') {
        await redisClient.set(redisKeyId, 'failed');
        await supabaseClient.from('orders').upsert({ request_identifier: requestUniqueIdentifier, status: 'failed' });
      }
      return res.status(500).send(`Error Caught: ${error}`);
    }
  });

  app.listen(PORT, async () => {
    await redisClient.connect();
    console.log(`App listening on port ${PORT}`);
  });
}

module.exports = startServer;