# RoleBasedAccessing

## Purpose

Simplify assignment of user permissions.

## Principle

A role is created, given permissions, and assigned to users for a resource.
Later, a command is authorized only when one of the user's roles for that
resource contains the required permission. Before invoking `authorize`, the
application must establish the caller's identity through a trustworthy
authentication boundary and supply that identity as `User`; this concept does
not authenticate callers or establish User identity.

## Types

```types
external User
  The identity of a user, established by the application.
external Resource
  A resource over which a role grants permissions.
external Permission
  A permission that may be granted to a role.
external Command
  An opaque command returned when authorization succeeds.
```

## State

```state
a set of Roles with
  a unique name String
  a permissions set of Permission

a set of Assignments with
  a user User
  a resource Resource
  a role Role

  unique user and resource and role
```

## Actions

```actions
createRole (name: String) : returns (role: Role)
  where a Role already has the given name
  then
    refuses ROLE_NAME_ALREADY_EXISTS "A Role already has that name."
  where no Role has the given name
  then
    create a new Role with given name and no permissions
    returns role

deleteRole (role: Role) : returns ()
  where role does not exist
  then
    refuses ROLE_NOT_FOUND "There is no such Role."
  where role exists and an Assignment uses role
  then
    refuses ROLE_IN_USE "The Role is assigned and cannot be deleted."
  where role exists and no Assignment uses role
  then
    remove role
    returns

permit (role: Role, permission: Permission) : returns ()
  where role does not exist
  then
    refuses ROLE_NOT_FOUND "There is no such Role."
  where role exists and permission is already in role permissions
  then
    refuses PERMISSION_ALREADY_GRANTED "The Role already has that Permission."
  where role exists and permission is not already in role permissions
  then
    add permission to role permissions
    returns

revokePermission (role: Role, permission: Permission) : returns ()
  where role does not exist
  then
    refuses ROLE_NOT_FOUND "There is no such Role."
  where role exists and permission is not in role permissions
  then
    refuses PERMISSION_NOT_GRANTED "The Role does not have that Permission."
  where role exists and permission is in role permissions
  then
    remove permission from role permissions
    returns

assign (user: User, resource: Resource, role: Role) : returns (assignment: Assignment)
  where role does not exist
  then
    refuses ROLE_NOT_FOUND "There is no such Role."
  where role exists and an Assignment already connects user, resource, and role
  then
    refuses ASSIGNMENT_ALREADY_EXISTS "That Role is already assigned to the User for the Resource."
  where role exists and no Assignment connects user, resource, and role
  then
    create a new Assignment connecting user, resource, and role
    returns assignment

unassign (assignment: Assignment) : returns ()
  where assignment does not exist
  then
    refuses ASSIGNMENT_NOT_FOUND "There is no such Assignment."
  where assignment exists
  then
    remove assignment
    returns

authorize (user: User, resource: Resource, permission: Permission, command: Command) : returns (authorized: Command)
  where no Assignment connects user and resource to a role that has permission
  then
    refuses NOT_AUTHORIZED "The User does not have the required Permission for the Resource."
  where some Assignment connects user and resource to a role that has permission
  then
    set authorized to command
    returns authorized
```

## Queries

```queries
_roles () : many (role: Role, name: String)
  answers every Role and its name
  answers no rows when there are no Roles
  orders rows by role name
_getRole (role: Role) : optional (name: String)
  answers no row for an unknown Role
_permissions (role: Role) : many (permission: Permission)
  answers the Permissions granted to the Role
  answers no rows for an unknown Role or a Role with no Permissions
  orders rows by stable Permission identity
_assignmentsFor (user: User, resource: Resource) : many (assignment: Assignment, role: Role)
  answers the Roles assigned to the User for the Resource
  answers no rows when the User has no Role assignments for the Resource
  orders rows by stable Assignment identity
_getAssignment (assignment: Assignment) : optional (user: User, resource: Resource, role: Role)
  answers no row for an unknown Assignment
```
