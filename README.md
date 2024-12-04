# Project 2: Man discovering altar of shapes

Name: Anthony Zhang <br>
netid: QCK6544 <br>
Project title: *Man discovering altar of shapes*
## Introduction

This graphics showcase a man standing behind an alter of different shapes flying around each other. The shapes include cube, diamonds, icosahedrons. They will fly in unpredictable motions.


## Summarization of files
- project2.html, this includes instruction for interactions and basic webpage structure
- project2.js, this include all the webgl code that allows the graphics to be rendered
- diamond.obj, this is the obj file for the diamond shape
- icosahedron.obj, this is the obj file for the icosahedron shape
- altar3.obj, this is the obj file for the altar shape
- man.obj, this is the obj file for the man shape
- img/, this is the folder for all the screenshots


## Overview of the interaction

### interaction of assembly
There is one assembly in this program, which is the floating shapes on top of the altar.

The user can click on the cube in the center to move it the rest of it's assembly around the scene.

The rotation speed slider below the canvas also allow the user to define the movement speed of the assembly. Higher speed means faster rotation/movement & vice versa.

### Interaction with the camera

Pressing `w`,`a`,`s`,`d` allows the user to move the camera itself forward, backwards, left and right. 

Pressing the `shift` button moves the camera down, `space` moves the camera up.

Pressing the arrow keys pan and rotate the camera to different angles, and allow the user to view the scene in different angles.

The Near and Far slider allows the user to define bound for the viewing frustum.

The FOVY slider allow the user to change the field of view of the camera.

The Aspect slider allow the user to change the aspect of the camera.

The Toggle button allows the user to toggle between a perspective camera and a Orthographic camera.


![Image 1](./img/image1.png)

![Image 2](./img/image2.png)

![Image 3](./img/image3.png)