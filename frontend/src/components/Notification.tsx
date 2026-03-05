import { Accessor } from "solid-js";
import { Notification } from "../utils/types";
function NotificationComponenet({
  passedClass,
  notification,
}: NotificationProps) {
  return (
    <div id="notification" class={passedClass}>
      <div class="mx-auto my-auto w-full p-10 flex flex-col gap-5">
        <p class="text-yellow-500 text-7xl font-bold font-laquer">
          {notification()?.heading}
        </p>
        <p class="text-4xl text-yellow-500 font-marker">
          {notification()?.content}
        </p>
      </div>
    </div>
  );
}

export default NotificationComponenet;

type NotificationProps = {
  passedClass: string;
  notification: Accessor<Notification | null>;
};
