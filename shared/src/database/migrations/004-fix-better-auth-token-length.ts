import { DataTypes, QueryInterface } from 'sequelize';

export async function up(queryInterface: QueryInterface): Promise<void> {
  // Change token columns to TEXT to handle long OAuth tokens
  await queryInterface.changeColumn('account', 'accessToken', {
    type: DataTypes.TEXT,
    allowNull: true,
  });

  await queryInterface.changeColumn('account', 'refreshToken', {
    type: DataTypes.TEXT,
    allowNull: true,
  });

  await queryInterface.changeColumn('account', 'idToken', {
    type: DataTypes.TEXT,
    allowNull: true,
  });

  await queryInterface.changeColumn('account', 'scope', {
    type: DataTypes.TEXT,
    allowNull: true,
  });

  await queryInterface.changeColumn('verification', 'value', {
    type: DataTypes.TEXT,
    allowNull: false,
  });
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.changeColumn('account', 'accessToken', {
    type: DataTypes.STRING,
    allowNull: true,
  });

  await queryInterface.changeColumn('account', 'refreshToken', {
    type: DataTypes.STRING,
    allowNull: true,
  });

  await queryInterface.changeColumn('account', 'idToken', {
    type: DataTypes.STRING,
    allowNull: true,
  });

  await queryInterface.changeColumn('account', 'scope', {
    type: DataTypes.STRING,
    allowNull: true,
  });

  await queryInterface.changeColumn('verification', 'value', {
    type: DataTypes.STRING,
    allowNull: false,
  });
}
