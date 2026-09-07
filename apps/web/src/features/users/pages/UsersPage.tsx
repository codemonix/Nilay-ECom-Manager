import { useState } from "react";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Table from "@mui/material/Table";
import TableHead from "@mui/material/TableHead";
import TableBody from "@mui/material/TableBody";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import Select, { type SelectChangeEvent } from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Switch from "@mui/material/Switch";
import Chip from "@mui/material/Chip";
import Skeleton from "@mui/material/Skeleton";
import Tooltip from "@mui/material/Tooltip";
import AddIcon from "@mui/icons-material/Add";
import LockResetIcon from "@mui/icons-material/LockReset";
import VpnKeyIcon from "@mui/icons-material/VpnKey";
import { useTranslation } from "react-i18next";
import { STAFF_ROLE_VALUES, StaffRole } from "@complaint-system/shared";
import type { UserDTO } from "@complaint-system/shared";
import { useAppSelector } from "../../../app/hooks";
import { useListAllUsersQuery, useUpdateUserMutation } from "../api/usersApi";
import { EmptyState } from "../../../components/EmptyState";
import { CreateUserDialog } from "../components/CreateUserDialog";
import { ResetPasswordDialog } from "../components/ResetPasswordDialog";
import { EditPermissionsDialog } from "../components/EditPermissionsDialog";

export function UsersPage() {
  const { t } = useTranslation(["users", "common"]);
  const currentUserId = useAppSelector((state) => state.auth.user?.id);
  const { data: users, isLoading } = useListAllUsersQuery();
  const [updateUser] = useUpdateUserMutation();
  const [createOpen, setCreateOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<UserDTO | null>(null);
  const [permissionsTarget, setPermissionsTarget] = useState<UserDTO | null>(null);

  const accessSummary = (user: UserDTO) => {
    if (user.role === StaffRole.ADMIN) return t("users:permissions.summaryAll");
    if (user.permissions.length === 0) return t("users:permissions.summaryNone");
    return t("users:permissions.summaryCount", { count: user.permissions.length });
  };

  const handleRoleChange = (user: UserDTO, event: SelectChangeEvent<string>) => {
    void updateUser({ id: user.id, role: event.target.value });
  };

  const handleActiveToggle = (user: UserDTO, active: boolean) => {
    void updateUser({ id: user.id, active });
  };

  return (
    <Stack spacing={2.5}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" useFlexGap>
        <Typography variant="h1">{t("users:title")}</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
          {t("users:create.action")}
        </Button>
      </Stack>

      <Paper variant="outlined" sx={{ p: 2.5 }}>
        {isLoading && (
          <Stack spacing={1}>
            {[1, 2, 3].map((key) => (
              <Skeleton key={key} variant="rounded" height={40} />
            ))}
          </Stack>
        )}

        {users && users.length === 0 && <EmptyState message={t("common:state.empty")} />}

        {users && users.length > 0 && (
          <TableContainer sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t("users:table.name")}</TableCell>
                  <TableCell>{t("users:table.email")}</TableCell>
                  <TableCell>{t("users:table.role")}</TableCell>
                  <TableCell>{t("users:table.status")}</TableCell>
                  <TableCell>{t("users:table.access")}</TableCell>
                  <TableCell align="right">{t("users:table.actions")}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {users.map((user) => {
                  const isSelf = user.id === currentUserId;
                  return (
                    <TableRow key={user.id} hover>
                      <TableCell>{user.name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Select
                          size="small"
                          value={user.role}
                          disabled={isSelf}
                          onChange={(event) => handleRoleChange(user, event)}
                          sx={{ minWidth: 160 }}
                        >
                          {STAFF_ROLE_VALUES.map((role) => (
                            <MenuItem key={role} value={role}>
                              {t(`common:roles.${role}`)}
                            </MenuItem>
                          ))}
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Tooltip title={isSelf ? t("users:table.cannotDeactivateSelf") : ""}>
                          <span>
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Switch
                                size="small"
                                checked={user.active}
                                disabled={isSelf}
                                onChange={(e) => handleActiveToggle(user, e.target.checked)}
                              />
                              <Chip
                                size="small"
                                label={user.active ? t("users:table.active") : t("users:table.inactive")}
                                color={user.active ? "success" : "default"}
                                variant="outlined"
                              />
                            </Stack>
                          </span>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={accessSummary(user)}
                          color={user.role !== StaffRole.ADMIN && user.permissions.length === 0 ? "warning" : "default"}
                          variant="outlined"
                          onClick={() => setPermissionsTarget(user)}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          <Tooltip title={t("users:permissions.action") as string}>
                            <Button size="small" startIcon={<VpnKeyIcon />} onClick={() => setPermissionsTarget(user)}>
                              {t("users:permissions.action")}
                            </Button>
                          </Tooltip>
                          <Tooltip title={t("users:table.resetPassword") as string}>
                            <Button size="small" startIcon={<LockResetIcon />} onClick={() => setResetTarget(user)}>
                              {t("users:table.resetPassword")}
                            </Button>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      <CreateUserDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      <ResetPasswordDialog user={resetTarget} onClose={() => setResetTarget(null)} />
      <EditPermissionsDialog user={permissionsTarget} onClose={() => setPermissionsTarget(null)} />
    </Stack>
  );
}
