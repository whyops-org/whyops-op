import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../database';

export type EvalCategory =
  | 'happy_path'
  | 'edge_case'
  | 'multi_step'
  | 'safety'
  | 'error_handling'
  | 'adversarial'
  | 'feature_specific';

export type EvalDifficulty = 'basic' | 'intermediate' | 'advanced';

export interface EvalConversationTurn {
  role: 'user' | 'assistant' | 'system';
  content: string;
  expected_tool_calls?: Array<{
    name: string;
    arguments?: Record<string, any>;
  }>;
  expected_behavior?: string;
}

export interface EvalExpectedOutcome {
  tools_called?: string[];
  key_assertions?: string[];
  refusal_expected?: boolean;
  quality_criteria?: string[];
}

export interface EvalScoringRubric {
  dimensions?: Array<{
    name: string;
    weight: number;
    criteria: string;
  }>;
}

export interface EvalCaseAttributes {
  id: string;
  runId: string;
  agentId: string;
  category: EvalCategory;
  subcategory?: string;
  title: string;
  description?: string;
  conversation: EvalConversationTurn[];
  expectedOutcome: EvalExpectedOutcome;
  scoringRubric: EvalScoringRubric;
  difficulty: EvalDifficulty;
  toolsTested: string[];
  metadata?: Record<string, any>;
  createdAt: Date;
}

interface EvalCaseCreationAttributes
  extends Optional<
    EvalCaseAttributes,
    | 'id'
    | 'subcategory'
    | 'description'
    | 'conversation'
    | 'expectedOutcome'
    | 'scoringRubric'
    | 'difficulty'
    | 'toolsTested'
    | 'metadata'
    | 'createdAt'
  > {}

export class EvalCase
  extends Model<EvalCaseAttributes, EvalCaseCreationAttributes>
  implements EvalCaseAttributes
{
  declare id: string;
  declare runId: string;
  declare agentId: string;
  declare category: EvalCategory;
  declare subcategory?: string;
  declare title: string;
  declare description?: string;
  declare conversation: EvalConversationTurn[];
  declare expectedOutcome: EvalExpectedOutcome;
  declare scoringRubric: EvalScoringRubric;
  declare difficulty: EvalDifficulty;
  declare toolsTested: string[];
  declare metadata?: Record<string, any>;
  declare createdAt: Date;
}

EvalCase.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    runId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'run_id',
      references: { model: 'eval_runs', key: 'id' },
      onDelete: 'CASCADE',
    },
    agentId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'agent_id',
      references: { model: 'agents', key: 'id' },
      onDelete: 'CASCADE',
    },
    category: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    subcategory: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    conversation: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },
    expectedOutcome: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
      field: 'expected_outcome',
    },
    scoringRubric: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
      field: 'scoring_rubric',
    },
    difficulty: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'basic',
    },
    toolsTested: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
      field: 'tools_tested',
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'created_at',
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'eval_cases',
    timestamps: true,
    updatedAt: false,
    indexes: [
      { fields: ['run_id'] },
      { fields: ['agent_id', 'category'] },
      { fields: ['agent_id', 'created_at'] },
    ],
  }
);

export default EvalCase;
