const expect = require('chai').expect;
const _ = require('lodash');

const query = require('../../database/query');
const queryProcess = require('../../business/query-process');
const TableContent = require('../../database/stream/table-content');
const utils = require('../../utils/utils');
const queryProcessFactory = require('../../business/query-process-factory');
const strUtils = require('../../utils/str');

describe('Query', () => {
    describe('#getTables()', () => {
        it('should query database for tables', (done) => {
            const connection = {
                query(queryString, callback) {
                    expect(queryString).to.be.equal('SHOW FULL TABLES IN `test` WHERE TABLE_TYPE NOT LIKE "VIEW"');

                    callback(undefined, [
                        { 'Tables_in_database': 'table1' },
                        { 'Tables_in_database': 'table2' },
                    ]);
                },
                config: { database: 'test' }
            }
            const concatFn = (str) => {
                expect(true).to.be.true;

                return 'SHOW FULL TABLES IN `test` WHERE TABLE_TYPE NOT LIKE "VIEW"';
            }

            query.getTables(connection, concatFn)
                .then(res => {
                    expect(res.length).to.be.equal(2);
                    expect(res[0]['Tables_in_database']).to.be.equal('table1');
                    expect(res[1]['Tables_in_database']).to.be.equal('table2');

                    done();
                })
                .catch(err => console.log(err));
        });
    });

    describe('#getViewTables()', () => {
        it('should query database for view tables', (done) => {
            const connection = {
                config: { database: 'test' },
                query(queryString, callback) {

                    expect(queryString).to.be.equal("SELECT * FROM information_schema.views WHERE TABLE_SCHEMA = 'test'");

                    callback(undefined, [
                        { 'VIEW_DEFINITION': "SELECT *, 'static' AS static_field FROM table1", 'DEFINER': 'root@localhost' },
                        { 'VIEW_DEFINITION': 'SELECT * FROM table2', 'DEFINER': 'root@localhost' },
                    ]);
                }
            };
            const concatFn = (str) => {
                expect(true).to.be.true;

                return "SELECT * FROM information_schema.views WHERE TABLE_SCHEMA = 'test'";
            };

            query.getViewTables(connection, concatFn)
                .then(res => {
                    expect(res.length).to.be.equal(2);
                    expect(res).to.be.deep.equal([
                        { 'VIEW_DEFINITION': "SELECT *, 'static' AS static_field FROM table1", 'DEFINER': 'root@localhost' },
                        { 'VIEW_DEFINITION': 'SELECT * FROM table2', 'DEFINER': 'root@localhost' },
                    ]);

                    done();
                })
                .catch(err => console.log(err));
        });
    });

    describe('#getColumns()', () => {
        it('should return all columns from a table', (done) => {
            const columnsMock = [
                { Field: 'id', Key: 'PRI' }, { Field: 'name' }, { Field: 'id' },
                { Field: 'is_done', Key: 'MUL' }, { Field: 'unique_field', Key: 'UNI' },
            ];
            const connection = {
                query(queryString, callback) {

                    expect(queryString).to.be.equal('SHOW FULL COLUMNS FROM `table`');

                    callback(undefined, columnsMock);
                }
            };
            const concatFn = (str) => {
                expect(true).to.be.true;

                return 'SHOW FULL COLUMNS FROM `table`';
            };

            query.getColumns(connection, 'table', concatFn)
                .then(columns => {
                    expect(columns.length).to.be.equal(5);
                    expect(columns).to.be.deep.equal(columnsMock);

                    done();
                })
                .catch(err => (console.log(err)));
        });
    });

    describe('#getCreateTable()', () => {
        it('should return create table script for a table', (done) => {
            const connection = {
                config: {
                    database: 'database'
                },
                query(queryString, callback) {
                    expect(queryString).to.be.equal('SHOW CREATE TABLE `table1`');

                    callback(undefined, [
                        {
                            'Create Table': 'CREATE TABLE table1'
                        }
                    ]);
                }
            };
            const concatFn = (str) => {
                expect(true).to.be.true;

                return 'SHOW CREATE TABLE `table1`';
            };

            query.getCreateTable(connection, 'table1', concatFn)
                .then(createTable => {
                    expect(createTable).to.be.equal('CREATE TABLE table1');
                    done();
                })
                .catch(err => (console.log(err)));
        });
    });

    describe('#getContent()', () => {
        it('should execute SELECT * query for a table', (done) => {
            const connection = {
                query(queryString, callback) {
                    expect(queryString).to.be.equal('SELECT * FROM `todos`')

                    callback(undefined, [
                        {
                            id: 1,
                            title: 'Todo #1',
                            description: 'Important'
                        }, {
                            id: 2,
                            title: 'Todo #2',
                            description: 'Not tmportant'
                        },
                    ]);
                }
            };
            const data = [
                {
                    id: 1,
                    title: 'Todo #1',
                    description: 'Important'
                }, {
                    id: 2,
                    title: 'Todo #2',
                    description: 'Not tmportant'
                }];
            const content$ = {
                on(event, fn) {
                    if (event !== 'error') {
                        expect(['data', 'end'].includes(event));
                        fn(data);
                    }
                }
            };

            query.getContent(content$)
                .then(res => {
                    expect(res.length).to.be.equal(2);
                    expect(res).to.be.deep.equal(data);

                    done();
                })
                .catch(err => console.log(err));
        });
    });

    describe('#getProcedures()', () => {
        it('should get all procedures and functions for a database', (done) => {
            const getProceduresMetaFn = (connection, concatFn) => {
                expect(true).to.be.true;

                return Promise.resolve([
                    {
                        SPECIFIC_NAME: 'proc1',
                        ROUTINE_TYPE: 'PROCEDURE'
                    },
                    {
                        SPECIFIC_NAME: 'func1',
                        ROUTINE_TYPE: 'FUNCTION'
                    },
                ]);
            }
            const getProcedureDefinitionFn = (connection, meta, normalizeProcedureDefinitionFn, concatFn) => {
                expect(['proc1', 'func1']).to.include(meta.name);
                expect(['PROCEDURE', 'FUNCTION']).to.include(meta.type);

                return Promise.resolve(
                    meta.type === 'FUNCTION' ? 'SET @foo = 1' : 'SET @bar = 1'
                );
            }
            const concatFn = (str) => {
                expect(true).to.be.true;
            }

            query.getProcedures({}, getProceduresMetaFn, getProcedureDefinitionFn, concatFn)
                .then(procedures => {
                    expect(procedures).to.deep.equal([
                        'SET @bar = 1', 'SET @foo = 1'
                    ]);

                    done();
                })
                .catch(console.log);
        });
    });

    describe('#getProceduresMeta()', () => {
        it('should return all procedures meta data', (done) => {
            const proceduresMock = [
                {
                    SPECIFIC_NAME: 'proc1',
                    ROUTINE_TYPE: 'PROCEDURE'
                }, {
                    SPECIFIC_NAME: 'func1',
                    ROUTINE_TYPE: 'FUNCTION'
                },
            ];
            const connection = {
                config: { database: 'database' },
                query(queryString, callback) {
                    expect(queryString).to.be.equal("SELECT * FROM INFORMATION_SCHEMA.ROUTINES WHERE ROUTINE_SCHEMA = 'database'");

                    callback(null, proceduresMock);
                }
            };
            const concatFn = (str) => {
                expect(true).to.be.true;

                return "SELECT * FROM INFORMATION_SCHEMA.ROUTINES WHERE ROUTINE_SCHEMA = 'database'";
            }
            query.getProceduresMeta(connection, concatFn)
                .then(procedures => {
                    expect(procedures).to.be.deep.equal(proceduresMock);
                    done();
                });
        });
    });

    describe('#getProcedureDefinition()', () => {
        it('should return definition for a given procedure', (done) => {
            const connection = {
                config: { database: 'database' },
                query(queryString, callback) {
                    expect(queryString).to.be.equal("SHOW CREATE PROCEDURE `proc1`");

                    callback(null, ['SET @foo = 1']);
                }
            };
            const concatFn = (str) => {
                expect(true).to.be.true;

                return "SHOW CREATE PROCEDURE `proc1`";
            }
            const meta = { type: 'procedure', name: 'proc1' };
            query.getProcedureDefinition(connection, meta, concatFn)
                .then(p => {
                    expect(p.definition).to.be.equal('SET @foo = 1');
                    expect(p.type).to.be.equal('procedure');
                    done();
                })
                .catch(console.log);
        });
    });

    describe('#getTriggers', () => {
        it('should query view tables and call sanitize function', (done) => {
            const triggersMock = [
                { name: 'trigger1' }
            ];
            const connection = {
                config: {
                    database: 'database'
                },
                query(queryString, callback) {
                    expect(queryString).to.be.equal("SHOW TRIGGERS FROM `database`");
                    callback(null, triggersMock);
                }
            };
            const mapFn = (database, triggersRaw) => {
                expect(triggersRaw).to.be.equal(triggersMock);
                return triggersRaw;
            }
            const concatFn = (str) => {
                expect(true).to.be.true;

                return "SHOW TRIGGERS FROM `database`";
            }

            query.getTriggers(connection, mapFn, concatFn)
                .then(triggers => {
                    expect(triggers).to.be.equal(triggersMock)

                    done();
                })
                .catch(console.log);
        });
    });

    describe('#getTableData', () => {
        it('should call all function that produces table data', (done) => {
            const tablesMock = [
                { table: 'table1' }, { table: 'table2' }
            ];
            const config = {
                database: 'database',
                excludedTables: ['migrations']
            };
            const connection = {
            };
            const queryMock = {
                getTables() {
                    return new Promise((resolve, reject) => {
                        expect(true).to.be.true;
                        resolve(tablesMock);
                    });
                },
                getColumns() {
                    return new Promise((resolve, reject) => {
                        expect(true).to.be.true;
                        resolve([
                            { Field: 'column1' }, { Field: 'column2' }
                        ]);
                    });
                },
                getCreateTable() {
                    return new Promise((resolve, reject) => {
                        expect(true).to.be.true;
                        resolve('CREATE TABLE table1');
                    });
                },
                getContent() {
                    return new Promise((resolve, reject) => {
                        expect(true).to.be.true;
                        resolve([{ id: 1, name: 'First' }, { id: 2, name: 'Second' }]);
                    });
                }
            };

            query.getTableData(connection, queryMock, config, queryProcess, utils)
                .then(() => {
                    done()
                })
                .catch(console.log);
        });
    });
});
