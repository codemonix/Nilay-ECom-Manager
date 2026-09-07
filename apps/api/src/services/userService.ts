import { userRepository } from "../repositories/userRepository";

export async function listStaff() {
  return userRepository.listActive();
}
