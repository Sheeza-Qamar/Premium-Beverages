import { Suspense } from "react";
import SigninWithPassword from "../SigninWithPassword";

export default function Signin() {
  return (
    <div>
      <Suspense fallback={<p className="text-sm text-dark-5">Loading...</p>}>
        <SigninWithPassword />
      </Suspense>
      <p className="mt-6 text-center text-sm text-dark-5 dark:text-dark-6">
        After the first administrator is created, additional admins are added from
        the Administrators page. There is no public sign-up.
      </p>
    </div>
  );
}
