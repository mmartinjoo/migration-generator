const query = require('./database/query');
const mysql = require('mysql');

const config = require('./config.json');

const connection = mysql.createConnection({
    host: config.host || 'localhost',
    port: config.port || 3306,
    user: config.user || 'root',
    password: config.password || 'root',
    database: config.database
});

query.getProcedures(connection, query.mapProcedures)
    .then(res => {
        connection.end();
    })
    .catch(err => (console.log(err)));
