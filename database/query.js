const _ = require('lodash');

const TableContent = require('./stream/table-content');
const queryProcess = require('../business/query-process');
const utils = require('../utils/utils');
const strUtils = require('../utils/str');

/**
 * @param {Object} connection - Database connection
 * @return {Promise} - Contains array
 */
const getTables = (connection) => 
    new Promise((resolve, reject) => {
        connection.query('SHOW FULL TABLES IN `' + connection.config.database + '` WHERE TABLE_TYPE NOT LIKE "VIEW"', (err, tables) => 
            err ? reject(err) : resolve(tables));
    });

/**
 * @param {Object} connection - Database connection
 * @return {Promise} - Contains array
 */
const getViewTables = (connection) => 
    new Promise((resolve, reject) => {
        connection.query(`SELECT * FROM information_schema.views WHERE TABLE_SCHEMA = '${connection.config.database}'`, (err, viewTables) => 
            err ? reject(err) : resolve(viewTables));
    });

/**
 * @param {Object} connection - Database connection
 * @param {string} table - Table name
 * @return {Promise} - Contains array
 */
const getColumns = (connection, table) =>
    new Promise((resolve, reject) => {
        connection.query('SHOW FULL COLUMNS FROM `' + table + '`', (err, columns) => 
            err ? reject(err) : resolve(columns));
    });

/**
 * @param {TableContent} content$ - Readable stream that reads content of a tablo
 * @return {Promise} - Contains array
 */
const getContent = (content$) => 
    new Promise((resolve, reject) => {
        let rows = [];

        content$.on('error', err => reject(err));

        content$.on('data', chunk => {
            rows = rows.concat(chunk);
        });

        content$.on('end', () => {
            resolve(rows);
        });
    });

/**
 * @param {Object} connection - Database connection
 * @param {string} table - Table name
 * @returns {Promise} - Contains array
 */
const getCreateTable = (connection, table) => 
    new Promise((resolve, reject) => {
        connection.query('SHOW CREATE TABLE `' +  table +  '`', (err, result) => 
            err ? reject(err) : resolve(result[0]['Create Table']));
    });

/**
 * @param {Object} connection - Database connection
 * @return {Promise} - Contains array
 */
const getProcedures = (connection) => 
    new Promise((resolve, reject) => {
        getProceduresMeta(connection)
            .then(metas =>
                metas.map(meta => getProcedureDefinition(connection, { name: meta['SPECIFIC_NAME'], type: meta['ROUTINE_TYPE']}))
            )
            .then(promises => Promise.all(promises))
            .then(resolve)
            .catch(reject);
    });

/**
 * @param {Object} connection - Database connection
 * @return {Promise} - Contains array
 */
const getProceduresMeta = (connection) => 
    new Promise((resolve, reject) => {
        connection.query(`SELECT * FROM INFORMATION_SCHEMA.ROUTINES WHERE ROUTINE_SCHEMA = '${connection.config.database}'`, (err, procedures) => 
            err ? reject(err) : resolve(procedures));
    });

/**
 * @param {Object} connection - Database connection
 * @param {Object} meta - Contains meta data about procedure like name, type
 * @return {Promise} - Contains an object
 */
const getProcedureDefinition = (connection, meta) =>
    new Promise((resolve, reject) => {
        connection.query('SHOW CREATE ' + meta.type.toUpperCase() + ' `' + meta.name + '`', (err, definition) => 
            (err) ? reject(err) : resolve({ type: meta.type, definition: definition[0] }));
    });

/**
 * @param {Object} connection - Database connection
 * @return {Promise} - Contains array
 */
const getTriggers = (connection) => 
    new Promise((resolve, reject) => {
        connection.query('SHOW TRIGGERS FROM `' + connection.config.database + '`', (err, triggers) => 
            (err) ? reject(err) : resolve(triggers));
    });

/**
 * @param {Object} connection 
 * @param {Object} config 
 */
const getTableData = (connection, config) =>
    new Promise((resolve, reject) => {
        let tableData = [];

        getTables(connection)
            .then(queryProcess.mapTables(config))
            .then(queryProcess.filterExcluededTables(config))
            .then(tables => {
                tables.forEach((table, index) => {
                    tableData.push({
                        table,
                        dependencies: []
                    });

                    const content$ = new TableContent(connection, table, { max: 1, highWaterMark: Math.pow(2, 16) });


                    let columnsPromise = getColumns(connection, table);
                    let createTablePromise = getCreateTable(connection, table);
                    let contentPromise = getContent(content$);

                    Promise.all([columnsPromise, createTablePromise, contentPromise])
                        .then(([columns, createTable, content]) => {
                            tableData[index].columns = columns;
                            tableData[index].indexes = queryProcess.filterIndexes(columns);
                            tableData[index].dependencies = queryProcess.parseDependencies(table, createTable);
                            tableData[index].content = queryProcess.escapeRows(content);

                            if (index === tables.length - 1) {
                                return resolve(tableData);
                            }
                        })
                        .catch(err => {
                            return reject(err);
                        });
                });
            })
            .catch(err => {
                return reject(err);
            });
    });

module.exports = {
    getTables,
    getColumns,
    getCreateTable,
    getTableData,
    getContent,
    getProcedures,
    getTriggers,
    getViewTables,
    getProceduresMeta,
    getProcedureDefinition
}
