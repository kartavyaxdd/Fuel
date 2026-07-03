// TypeScript declaration for Express request augmentation
// This file allows us to add custom properties to the Request object

import { User } from '@nutrition/types'; // We might add user info later

export interface AuthRequest extends Request {
  user?: User | null;
  // Add other custom properties as needed
}

// You can also extend the Response object if needed
export interface CustomResponse extends Response {
  // Custom response methods or properties
}