import { getUserById } from "./user/get-user-by-id";
import { getUserByNameCode } from "./user/get-user-by-name-code";
import { signInWithPassword } from "./user/sign-in-with-passwords";
import { signUp } from "./user/sign-up";

export class UserModel {
  getUserById = getUserById;
  getUserByNameCode = getUserByNameCode;
  signInWithPassword = signInWithPassword;
  signUp = signUp;
}
