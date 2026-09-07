import FormControl from "@mui/material/FormControl";
import Select, { type SelectChangeEvent } from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Avatar from "@mui/material/Avatar";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { useAppDispatch, useAppSelector } from "../app/hooks";
import { setSelectedUserId } from "../store/devUserSlice";
import { useListUsersQuery } from "../features/users/api/usersApi";

function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/**
 * V1 has no real authentication (see docs/architecture.md). This selector
 * lets whoever is using the browser pick which seeded staff member they
 * are acting as; the choice is sent as x-user-id on every API request and
 * becomes the actor recorded on case events.
 */
export function DevUserSelector() {
  const { t } = useTranslation("common");
  const dispatch = useAppDispatch();
  const selectedUserId = useAppSelector((state) => state.devUser.selectedUserId);
  const { data: users = [] } = useListUsersQuery();

  const handleChange = (event: SelectChangeEvent<string>) => {
    dispatch(setSelectedUserId(event.target.value || null));
  };

  const selectedUser = users.find((u) => u.id === selectedUserId);

  return (
    <FormControl size="small" sx={{ minWidth: 200 }}>
      <Select
        value={selectedUserId && users.some((u) => u.id === selectedUserId) ? selectedUserId : ""}
        onChange={handleChange}
        displayEmpty
        renderValue={(value) => {
          if (!value || !selectedUser) {
            return <Typography color="text.secondary">{t("devUser.placeholder")}</Typography>;
          }
          return (
            <Stack direction="row" spacing={1} alignItems="center">
              <Avatar sx={{ width: 24, height: 24, fontSize: 12 }}>{initials(selectedUser.name)}</Avatar>
              <Typography noWrap>{selectedUser.name}</Typography>
            </Stack>
          );
        }}
        inputProps={{ "aria-label": t("devUser.label") }}
      >
        <MenuItem value="">
          <em>{t("devUser.none")}</em>
        </MenuItem>
        {users.map((user) => (
          <MenuItem key={user.id} value={user.id}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Avatar sx={{ width: 24, height: 24, fontSize: 12 }}>{initials(user.name)}</Avatar>
              <Typography>{user.name}</Typography>
            </Stack>
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
