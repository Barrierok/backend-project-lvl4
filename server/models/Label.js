import { Model } from 'objection';
import path from 'path';

export default class Label extends Model {
  static get tableName() {
    return 'labels';
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['name'],
      properties: {
        id: { type: 'integer' },
        name: { type: 'string', minLength: 1 },
      },
    };
  }

  static relationMappings = {
    tasks: {
      relation: Model.ManyToManyRelation,
      modelClass: path.join(__dirname, 'Task'),
      join: {
        from: 'labels.id',
        through: {
          from: 'tasks_labels.labelId',
          to: 'tasks_labels.taskId',
        },
        to: 'tasks.id',
      },
    },
  };
}
