import { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import { ErrorApi } from "../middlewares/error-handler";
import { prisma } from "../libs/prisma";
import type { newAdminBody, updateAdminBody } from "../schemas/admin";

export async function getTenantUser(req: Request, res: Response, next: NextFunction) {
    try {
        const tenantId = req.user!.tenantId

        const users = await prisma.user.findMany({
            where: {
                tenantId
            },
            select: {
                id: true,
                username: true,
                role: true,
                createdAt: true
            }
        })

        res.status(200).json({success: true, users})
    } catch (error) {
        next(error)
    }
}

export async function createNewAdmin(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const tenantId = req.user!.tenantId;

    const { username, password, role } = req.body as newAdminBody;

    const existedUser = await prisma.user.findUnique({
      where: {
        tenantId_username: {
          tenantId,
          username,
        },
      },
    });
    if (existedUser) {
      return next(
        new ErrorApi("username already exist, please try unique one", 400)
      );
    }

    const hashPassword = await bcrypt.hash(password, 12);

    const newUser = await prisma.user.create({
      data: {
        tenantId,
        username,
        password: hashPassword,
        role,
      },
    });

    res.status(201).json({
      success: true,
      message: `${newUser.username} has been added`,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateUser(
  req: Request<{ adminId: string }>,
  res: Response,
  next: NextFunction
) {
  try {
    const { adminId } = req.params;

    const user = await prisma.user.findFirst({
      where: {
        id: adminId,
      },
    });
    if (!user) return next(new ErrorApi("Username is not found", 400));

    const { username, password, role } = req.body as updateAdminBody;
    const data: any = {};

    if (username && username !== user.username) {
      data.username = username;
    }
    if (role && role !== user.role) {
      data.role = role;
    }
    if (password) {
      data.password = await bcrypt.hash(password, 12);
    }

    // prevent rewrite with empty data
    if (Object.keys(data).length === 0) {
      return next(new ErrorApi("No changed detected", 400));
    }

    await prisma.user.update({
      where: {
        id: adminId,
      },
      data: data,
    });

    res.status(200).json({ message: "username has been udpated" });
  } catch (error) {
    next(error);
  }
}

export async function deleteUserController(req: Request<{adminId: string}>, res: Response, next: NextFunction) {
    try {
        const {adminId} = req.params

        const activeUser = req.user!
        const user = await prisma.user.findUnique({
            where: { id: adminId}
        })
        if (!user) {
            return next(new ErrorApi("User not found", 400))
        }

        // tenant isolate
        if (user.tenantId !== activeUser.tenantId) return next(new ErrorApi("Forbidden", 403))
        
        // prevent delete owner
        if (user.role === "OWNER") return next(new ErrorApi("Forbidden action", 403))
        
        // prevent self delete
        if (user.username === activeUser.username) return next(new ErrorApi("Can not delete own account", 400))

        await prisma.user.delete({
            where: {
                id: adminId
            }
        })

        res.status(200).json({
            message: "username has been deleted"
        })
    } catch (error) {
        next(error)
    }
}
