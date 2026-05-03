export type MeetingType = "ADMIN" | "SAFETY" | "TF" | "ETC";

export type MeetingDepartmentOption = {
  id: string;
  name: string;
};

export type MeetingDraftItem = {
  content: string;
  id: string;
  isSelected: boolean;
  isUrgent: boolean;
  recommendedDepartments: string[];
  selectedDepartmentIds: string[];
  status: string;
  title: string;
};

export type MeetingRecordItem = {
  content: string;
  createdAt: string;
  drafts: MeetingDraftItem[];
  id: string;
  meetingDate: string;
  meetingType: MeetingType;
  title: string;
  uploadedFileUrl: string | null;
};

export type MeetingManagementData = {
  departments: MeetingDepartmentOption[];
  meetings: MeetingRecordItem[];
};
