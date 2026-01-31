import User from './User';
import Provider from './Provider';
import ApiKey from './ApiKey';
import LLMEvent from './LLMEvent';
import RequestLog from './RequestLog';

// Define associations
User.hasMany(Provider, { foreignKey: 'userId', as: 'providers' });
Provider.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasMany(ApiKey, { foreignKey: 'userId', as: 'apiKeys' });
ApiKey.belongsTo(User, { foreignKey: 'userId', as: 'user' });

Provider.hasMany(ApiKey, { foreignKey: 'providerId', as: 'apiKeys' });
ApiKey.belongsTo(Provider, { foreignKey: 'providerId', as: 'provider' });

User.hasMany(LLMEvent, { foreignKey: 'userId', as: 'events' });
LLMEvent.belongsTo(User, { foreignKey: 'userId', as: 'user' });

Provider.hasMany(LLMEvent, { foreignKey: 'providerId', as: 'events' });
LLMEvent.belongsTo(Provider, { foreignKey: 'providerId', as: 'providerDetails' });

export { User, Provider, ApiKey, LLMEvent, RequestLog };

export const models = {
  User,
  Provider,
  ApiKey,
  LLMEvent,
  RequestLog,
};

export default models;
