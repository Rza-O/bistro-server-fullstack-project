const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();
const port = process.env.PORT || 8000

// middleware
app.use(cors());
app.use(express.json());

app.get('/', (req,res) => {
   res.send('Bistro Restro is running')
})

app.listen(port, () => {
   console.log(`Bistro is running on ${port}`);
})