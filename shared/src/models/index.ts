import User from './User';
import Provider from './Provider';
import ApiKey from './ApiKey';
import LLMEvent from './LLMEvent';
import RequestLog from './RequestLog';
import Trace from './Trace';
import Entity from './Entity';

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

// Trace associations
Trace.belongsTo(User, { foreignKey: 'userId', as: 'user' });
User.hasMany(Trace, { foreignKey: 'userId', as: 'traces' });

Trace.hasMany(LLMEvent, { foreignKey: 'traceId', sourceKey: 'id', as: 'events' });
LLMEvent.belongsTo(Trace, { foreignKey: 'traceId', targetKey: 'id', as: 'trace' });

// Entity associations
User.hasMany(Entity, { foreignKey: 'userId', as: 'entities' });
Entity.belongsTo(User, { foreignKey: 'userId', as: 'user' });

LLMEvent.belongsTo(Entity, { foreignKey: 'entityId', as: 'entity' });
// Entity.hasMany(LLMEvent, { foreignKey: 'entityId', as: 'events' }); // Removed redundant association

Trace.belongsTo(Entity, { foreignKey: 'entityId', as: 'entity' });
Entity.hasMany(Trace, { foreignKey: 'entityId', as: 'traces' });

export { User, Provider, ApiKey, LLMEvent, RequestLog, Trace, Entity };

export const models = {
  User,
  Provider,
  ApiKey,
  LLMEvent,
  RequestLog,
  Trace,
  Entity,
};

export default models;
