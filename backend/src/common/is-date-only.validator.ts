import { registerDecorator, ValidationOptions } from 'class-validator';
import { isDateOnly } from './date-only.js';

/** class-validator rule: a real calendar date in YYYY-MM-DD form. */
export function IsDateOnly(options?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isDateOnly',
      target: object.constructor,
      propertyName,
      options: {
        message: `${propertyName} must be a real date in YYYY-MM-DD format`,
        ...options,
      },
      validator: { validate: (value: unknown) => isDateOnly(value) },
    });
  };
}
