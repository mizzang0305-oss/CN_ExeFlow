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
  createdByName: string | null;
  drafts: MeetingDraftItem[];
  fileName: string | null;
  fileUrl: string | null;
  id: string;
  meetingDate: string;
  meetingType: MeetingType;
  title: string;
  updatedAt: string | null;
  uploadedFileUrl: string | null;
};

export type MeetingManagementData = {
  departments: MeetingDepartmentOption[];
  meetings: MeetingRecordItem[];
};
