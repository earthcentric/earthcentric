import { auth, currentUser } from "@clerk/nextjs/server";

export async function getVerifiedClerkIdentity(): Promise<{
  id: string;
  email: string;
  name: string;
} | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const clerkUser = await currentUser();
  if (!clerkUser || clerkUser.id !== userId || !clerkUser.primaryEmailAddressId) {
    return null;
  }

  const primaryEmail = clerkUser.emailAddresses.find(
    (emailAddress) => emailAddress.id === clerkUser.primaryEmailAddressId
  );
  if (!primaryEmail || primaryEmail.verification?.status !== "verified") {
    return null;
  }

  return {
    id: clerkUser.id,
    email: primaryEmail.emailAddress.trim().toLowerCase(),
    name: [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
      clerkUser.username ||
      "Conscious Buyer",
  };
}
