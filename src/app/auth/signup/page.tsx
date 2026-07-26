import { SignUp } from "@clerk/nextjs";

export default function SignupPage() {
  return (
    <div className="flex-1 flex items-center justify-center py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-accent/5 to-transparent">
      <SignUp />
    </div>
  );
}
