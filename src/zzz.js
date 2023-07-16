const { DataTypes } = require('sequelize');
const sequelize = require('./connectMySQL');

const zzz = sequelize.define('zzz', {
    num: {
        type: DataTypes.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
    },
    user_id: {
        type: DataTypes.STRING(24),
        allowNull: false
    },
    is_authorized: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    authcookie: {
        type: DataTypes.STRING(112),
        allowNull: true
    },
    srv_uid: {
        type: DataTypes.STRING(9),
        allowNull: true
    },
    srv_reg: {
        type: DataTypes.STRING(7),
        allowNull: true
    }
}, {
    modelName: 'zzz',
    tableName: 'zzz',
    timestamps: true,
    underscored: true,
});

zzz.associate = function (models) {
    zzz.belongsTo(models.user, { as: 'user', foreignKey: 'user_id' });
}

module.exports = zzz;