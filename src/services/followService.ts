import { collection, getCountFromServer, query, where } from 'firebase/firestore';

import { db } from '@/lib/firebase';

/// Follows are docs `follows/{followerUid}_{followeeUid}` holding both
/// uids. There's no Follow button yet — only the counts, so the profile
/// can show them now and a follow UI can be added later without a
/// data migration.
export const FollowService = {
  async getCounts(uid: string): Promise<{ followers: number; following: number }> {
    const follows = collection(db, 'follows');
    const [followers, following] = await Promise.all([
      getCountFromServer(query(follows, where('followeeUid', '==', uid))),
      getCountFromServer(query(follows, where('followerUid', '==', uid))),
    ]);
    return { followers: followers.data().count, following: following.data().count };
  },
};
