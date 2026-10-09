/** Planning owns crew and assignments. UI comes later. */
export type CrewMember = {
  id: string;
  name: string;
};

export type Assignment = {
  id: string;
  crewMemberId: string;
  projectId: string | null;
  startsOn: string;
  endsOn: string;
};
