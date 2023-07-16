const Sequelize = require("sequelize");
const { env } = require('process');

const sequelize = new Sequelize('miyabi', env.MYSQL_USERNAME, env.MYSQL_PASSWORD, {
    host: 'localhost',
    port: '3306',
    dialect: 'mysql',
    logging: false
});

(async () => {
    try {
        await sequelize.authenticate();
        await sequelize.sync();
        console.log('Connected to the MySQL database.');
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
})();

module.exports = sequelize;