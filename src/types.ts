export interface UserProfile {
  uid: string;
  displayName: string;
  photoURL: string;
  email: string;
  phoneNumber?: string;
  age?: number;
  gender?: string;
  city?: string;
  isVerified?: boolean;
  // Trust & Verification Layer
  trustScore?: number;
  verificationLevel?: 'Highly Trusted' | 'Verified Traveler' | 'Partially Verified' | 'Unverified';
  verificationSource?: string;
  verifiedAt?: any;
  documentType?: string;
  maskedDocumentId?: string;
  completedTrips?: number;
  rating?: number;
  bio?: string;
}

export interface TripPost {
  id: string;
  ownerUid: string;
  ownerName: string;
  ownerPhoto: string;
  destination: string;
  travelDate: string;
  age: number;
  gender: string;
  city: string;
  lookingFor: 'Solo' | 'Group' | 'Male' | 'Female' | 'Anyone';
  description?: string;
  createdAt: any;
}

export interface JoinRequest {
  id: string;
  tripId: string;
  tripOwnerUid: string;
  requesterUid: string;
  requesterName: string;
  requesterPhoto: string;
  requesterPhone: string;
  ownerPhone?: string;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  createdAt: any;
}

export interface Team {
  id: string;
  tripId: string;
  members: string[];
  createdAt: any;
}

export interface ChatMessage {
  id: string;
  teamId: string;
  senderUid: string;
  senderName: string;
  text: string;
  createdAt: any;
}
