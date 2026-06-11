// Polyfill for @lark-apaas/client-toolkit/tools/services
// Mock classes and types for Lark platform service entities in standalone mode

// ---- Types ----

export interface UserInfo {
  id: string;
  name: string;
  avatarUrl?: string;
  email?: string;
}

export interface DepartmentInfo {
  id: string;
  name: string;
  parentId?: string;
}

export interface SearchAvatar {
  avatar_url?: string;
  avatar_key?: string;
}

export type AccountType = 'user' | 'bot' | 'department' | 'apaas';

export interface SearchUsersParams {
  query?: string;
  searchExternalContact?: boolean;
  pageSize?: number;
  pageToken?: string;
}

export interface SearchUsersResponse {
  users: UserInfo[];
  nextPageToken?: string;
}

export interface BatchGetUsersResponse {
  users: UserInfo[];
}

export interface ConvertExternalContactResponse {
  success: boolean;
}

export interface SearchChatsParams {
  query?: string;
  pageSize?: number;
  pageToken?: string;
}

export interface ChatInfo {
  id: string;
  name: string;
  avatarUrl?: string;
}

export interface SearchChatsResponse {
  chats: ChatInfo[];
  nextPageToken?: string;
}

export interface BatchGetChatsResponse {
  chats: ChatInfo[];
}

export interface SearchDepartmentsParams {
  query?: string;
  pageSize?: number;
  pageToken?: string;
}

export interface SearchDepartmentsResponse {
  departments: DepartmentInfo[];
  nextPageToken?: string;
}

export interface UserProfileData {
  userId: string;
  name: string;
  avatarUrl?: string;
  department?: string;
}

// ---- Mock Service Classes ----

export class UserService {
  async searchUsers(_params: SearchUsersParams): Promise<SearchUsersResponse> {
    console.warn('[polyfill] UserService.searchUsers called - no backend available');
    return { users: [] };
  }

  async listUsersByIds(_userIds: string[]): Promise<BatchGetUsersResponse> {
    console.warn('[polyfill] UserService.listUsersByIds called - no backend available');
    return { users: [] };
  }

  async convertExternalContact(_larkUserID: string): Promise<ConvertExternalContactResponse> {
    console.warn('[polyfill] UserService.convertExternalContact called - no backend available');
    return { success: false };
  }
}

export class ChatService {
  async searchChats(_params: SearchChatsParams): Promise<SearchChatsResponse> {
    console.warn('[polyfill] ChatService.searchChats called - no backend available');
    return { chats: [] };
  }

  async listChatsByIds(_chatIds: string[]): Promise<BatchGetChatsResponse> {
    console.warn('[polyfill] ChatService.listChatsByIds called - no backend available');
    return { chats: [] };
  }
}

export class DepartmentService {
  async searchDepartments(_params: SearchDepartmentsParams): Promise<SearchDepartmentsResponse> {
    console.warn('[polyfill] DepartmentService.searchDepartments called - no backend available');
    return { departments: [] };
  }
}

export class UserProfileService {
  async getUserProfile(_userId: string, _accountType: AccountType = 'apaas', _signal?: AbortSignal): Promise<UserProfileData> {
    console.warn('[polyfill] UserProfileService.getUserProfile called - no backend available');
    return { userId: _userId, name: 'Unknown User' };
  }
}

export function getAssetsUrl(_path: string): string {
  return '';
}